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
        private readonly helper: RepairOrderCreateHelperService
    ) { }

    async create(adminId: string, branchId: string, statusId: string, dto: CreateRepairOrderDto) {
        const trx = await this.knex.transaction();

        try {
            await this.permissionService.validatePermissionOrThrow(adminId, statusId, 'can_add', 'repair_order_permission');

            const sort = await getNextSortValue(this.knex, 'repair_orders', { where: { branch_id: branchId } });

            const [order] = await trx('repair_orders')
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

            return { message: 'Repair order created successfully', data: order };
        } catch (err) {
            await trx.rollback();
            throw err;
        }
    }


    async update(adminId: string, orderId: string, dto: UpdateRepairOrderDto) {
        const trx = await this.knex.transaction();

        try {
            const order = await trx('repair_orders').where({ id: orderId }).first();
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
                await trx('repair_orders').update({ ...updatedFields, updated_at: new Date() }).where({ id: orderId });
            }

            await this.changeLogger.logMultipleFieldsIfChanged(trx, orderId, logFields, adminId);

            await this.assignAdminUpdater.update(trx, orderId, dto.admin_ids, adminId, statusId);
            await this.initialProblemUpdater.update(trx, orderId, dto.initial_problems, adminId, statusId);
            await this.finalProblemUpdater.update(trx, orderId, dto.final_problems, adminId, statusId);
            await this.commentUpdater.update(trx, orderId, dto.comments, adminId, statusId);
            await this.pickupUpdater.update(trx, orderId, dto.pickup, adminId, statusId);
            await this.deliveryUpdater.update(trx, orderId, dto.delivery, adminId, statusId);

            await trx.commit();

            return { message: 'Repair order updated successfully' };
        } catch (err) {
            await trx.rollback();
            throw err;
        }

    }


    async findAllByBranch(adminId: string, branchId: string) {
        const permissions = await this.permissionService.findByAdminBranch(adminId, branchId);

        const viewableStatusIds = permissions
            .filter((p) => p.can_view)
            .map((p) => p.status_id);

        if (!viewableStatusIds.length) {
            return [];
        }

        const orders = await this.knex('repair_orders')
            .whereIn('status_id', viewableStatusIds)
            .andWhere({ branch_id: branchId })
            .orderBy('created_at', 'desc');

        return orders;
    }

}