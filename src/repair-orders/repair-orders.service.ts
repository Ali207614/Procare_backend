import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectKnex } from 'nestjs-knex';
import { getNextSortValue } from 'src/common/utils/sort.util';
import { RepairOrderStatusPermissionsService } from 'src/repair-order-status-permission/repair-order-status-permissions.service';
import { CreateRepairOrderDto } from './dto/create-repair-order.dto';
import type { Knex } from 'knex';
import { RepairOrderCreateHelperService } from './services/repair-order-create-helper.service';
import { RepairOrderChangeLoggerService } from './services/repair-order-change-logger.service';
import { AssignAdminUpdaterService } from './services/assign-admin-updater.service';
import { InitialProblemUpdaterService } from './services/initial-problem-updater.service';
import { FinalProblemUpdaterService } from './services/final-problem-updater.service';
import { CommentUpdaterService } from './services/comment-updater.service';
import { PickupUpdaterService } from './services/pickup-updater.service';
import { DeliveryUpdaterService } from './services/delivery-updater.service';
import { UpdateRepairOrderDto } from './dto/update-repair-order.dto';
import { PaginationQuery } from 'src/common/types/pagination-query.interface';
import { RedisService } from 'src/common/redis/redis.service';
@Injectable()
export class RepairOrdersService {
    private readonly table = 'repair_orders';

    constructor(
        @InjectKnex() private readonly knex: Knex,
        private readonly permissionService: RepairOrderStatusPermissionsService,
        private readonly changeLogger: RepairOrderChangeLoggerService,
        private readonly assignAdminUpdater: AssignAdminUpdaterService,
        private readonly initialProblemUpdater: InitialProblemUpdaterService,
        private readonly finalProblemUpdater: FinalProblemUpdaterService,
        private readonly commentUpdater: CommentUpdaterService,
        private readonly pickupUpdater: PickupUpdaterService,
        private readonly deliveryUpdater: DeliveryUpdaterService,
        private readonly helper: RepairOrderCreateHelperService,
        private readonly redisService: RedisService
    ) { }

    async create(adminId: string, branchId: string, statusId: string, dto: CreateRepairOrderDto) {
        const trx = await this.knex.transaction();

        try {
            await this.permissionService.validatePermissionOrThrow(adminId, statusId, 'can_add', 'repair_order_permission');

            const sort = await getNextSortValue(this.knex, this.table, { where: { branch_id: branchId } });

            const [order] = await trx(this.table)
                .insert({
                    user_id: dto.user_id,
                    branch_id: branchId,
                    phone_category_id: dto.phone_category_id,
                    status_id: statusId,
                    sort,
                    delivery_method: 'Self',
                    pickup_method: 'Self',
                    created_by: adminId,
                    created_at: new Date(),
                    updated_at: new Date(),
                })
                .returning('*');

            await this.helper.insertAssignAdmins(trx, dto, adminId, statusId, order.id);
            await this.helper.insertInitialProblems(trx, dto, adminId, statusId, order.id);
            await this.helper.insertFinalProblems(trx, dto, adminId, statusId, order.id);
            await this.helper.insertComments(trx, dto, adminId, statusId, order.id);
            await this.helper.insertPickup(trx, dto, adminId, statusId, order.id);
            await this.helper.insertDelivery(trx, dto, adminId, statusId, order.id);

            await trx.commit();

            await this.redisService.flushByPrefix(`${this.table}:${branchId}`);

            return { message: 'Repair order created successfully', data: order };
        } catch (err) {
            await trx.rollback();
            throw err;
        }
    }


    async update(adminId: string, orderId: string, dto: UpdateRepairOrderDto) {
        const trx = await this.knex.transaction();

        try {
            const order = await trx(this.table).where({ id: orderId, status: 'Open' }).first();
            if (!order) {
                throw new NotFoundException({ message: 'Repair order not found', location: 'repair_order_id' });
            }

            const statusId = order.status_id;
            await this.permissionService.validatePermissionOrThrow(adminId, statusId, 'can_update', 'repair_order_permission');

            const logFields = [];
            const updatedFields: Partial<typeof order> = {};

            for (const field of ['user_id', 'status_id', 'priority', 'phone_category_id']) {
                if (dto[field] !== undefined && dto[field] !== order[field]) {
                    updatedFields[field] = dto[field];
                    logFields.push({ key: field, oldVal: order[field], newVal: dto[field] });
                }
            }

            if (Object.keys(updatedFields).length) {
                await trx(this.table).update({ ...updatedFields, updated_at: new Date() }).where({ id: orderId });
            }

            await this.changeLogger.logMultipleFieldsIfChanged(trx, orderId, logFields, adminId);

            await this.assignAdminUpdater.update(trx, orderId, dto.admin_ids, adminId, statusId);
            await this.initialProblemUpdater.update(trx, orderId, dto.initial_problems, adminId, statusId, dto.phone_category_id);
            await this.finalProblemUpdater.update(trx, orderId, dto.final_problems, adminId, statusId, dto.phone_category_id);
            await this.commentUpdater.update(trx, orderId, dto.comments, adminId, statusId);
            await this.pickupUpdater.update(trx, orderId, dto.pickup, adminId, statusId);
            await this.deliveryUpdater.update(trx, orderId, dto.delivery, adminId, statusId);

            await trx.commit();
            await this.redisService.flushByPrefix(`${this.table}:${order.branch_id}`);

            return { message: 'Repair order updated successfully' };
        } catch (err) {
            await trx.rollback();
            throw err;
        }

    }


    async findAllByAdminBranch(adminId: string, branchId: string, query: PaginationQuery) {
        const { page = 1, limit = 20, sortBy = 'sort', sortOrder = 'asc' } = query;
        const offset = (page - 1) * limit;

        const permissions = await this.permissionService.findByAdminBranch(adminId, branchId);
        const statusIds = permissions.filter(p => p.can_view).map(p => p.status_id);
        if (!statusIds.length) return {};

        const allCacheKeys = statusIds.map(
            statusId => `${this.table}:${branchId}:${adminId}:${statusId}:${sortBy}:${sortOrder}:${page}:${limit}`
        );

        const cachedResults = await this.redisService.mget(...allCacheKeys);

        const result: Record<string, any[]> = {};
        const missingStatusIds: string[] = [];

        statusIds.forEach((statusId, index) => {
            const cached = cachedResults[index];
            if (cached !== null) {
                result[statusId] = cached;
            } else {
                missingStatusIds.push(statusId);
            }
        });

        if (missingStatusIds.length) {
            const freshOrders = await this.knex('repair_orders as ro')
                .leftJoin('users as u', 'ro.user_id', 'u.id')
                .leftJoin('repair_order_pickups as p', 'ro.id', 'p.repair_order_id')
                .leftJoin('repair_order_deliveries as d', 'ro.id', 'd.repair_order_id')
                .leftJoin('phone_categories as pc', 'ro.phone_category_id', 'pc.id')
                .select(
                    'ro.*',
                    'u.first_name as client_first_name',
                    'u.last_name as client_last_name',
                    'u.phone_number as client_phone_number',
                    'p.description as pickup_description',
                    'd.description as delivery_description',
                    'pc.name_uz as phone_name'
                )
                .where('ro.branch_id', branchId)
                .where('ro.branch_id', branchId)
                .whereIn('ro.status_id', missingStatusIds)
                .andWhere('ro.status', '!=', 'Deleted')
                .orderBy('ro.status_id')
                .orderBy(`ro.${sortBy}`, sortOrder);

            for (const statusId of missingStatusIds) {
                const filtered = freshOrders.filter(o => o.status_id === statusId);
                const paginated = filtered.slice(offset, offset + limit);

                const cacheKey = `${this.table}:${branchId}:${adminId}:${statusId}:${sortBy}:${sortOrder}:${page}:${limit}`;
                await this.redisService.set(cacheKey, paginated, 300);

                result[statusId] = paginated;
            }
        }

        return result;
    }


}