import { BadRequestException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import { getNextSortValue } from 'src/common/utils/sort.util';
import { RepairOrderStatusPermissionsService } from 'src/repair-order-status-permission/repair-order-status-permissions.service';
import { PaginationQuery } from 'src/common/types/pagination-query.interface';
import { RedisService } from 'src/common/redis/redis.service';
import { loadSQL } from 'src/common/utils/sql-loader.util';
import {
  RepairOrder,
  RepairOrderDetails,
  FreshRepairOrder,
} from 'src/common/types/repair-order.interface';
import { RepairOrderStatusPermission } from 'src/common/types/repair-order-status-permssion.interface';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { RepairOrderChangeLoggerService } from 'src/repair-orders/services/repair-order-change-logger.service';
import { InitialProblemUpdaterService } from 'src/repair-orders/services/initial-problem-updater.service';
import { FinalProblemUpdaterService } from 'src/repair-orders/services/final-problem-updater.service';
import { RepairOrderCreateHelperService } from 'src/repair-orders/services/repair-order-create-helper.service';
import { LoggerService } from 'src/common/logger/logger.service';
import { CreateRepairOrderDto } from 'src/repair-orders/dto/create-repair-order.dto';
import { UpdateRepairOrderDto } from 'src/repair-orders/dto/update-repair-order.dto';
import { MoveRepairOrderDto } from 'src/repair-orders/dto/move-repair-order.dto';

@Injectable()
export class RepairOrdersService {
  private readonly table = 'repair_orders';

  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly permissionService: RepairOrderStatusPermissionsService,
    private readonly changeLogger: RepairOrderChangeLoggerService,
    private readonly initialProblemUpdater: InitialProblemUpdaterService,
    private readonly finalProblemUpdater: FinalProblemUpdaterService,
    private readonly helper: RepairOrderCreateHelperService,
    private readonly redisService: RedisService,
    private readonly logger: LoggerService,
  ) {}

  async create(
    admin: AdminPayload,
    branchId: string,
    statusId: string,
    dto: CreateRepairOrderDto,
  ): Promise<RepairOrder> {
    const trx = await this.knex.transaction();
    try {
      const permissions: RepairOrderStatusPermission[] =
        await this.permissionService.findByRolesAndBranch(admin.roles, branchId);
      await this.permissionService.checkPermissionsOrThrow(
        admin.roles,
        branchId,
        statusId,
        ['can_add'],
        'repair_order_permission',
        permissions,
      );

      const user = await trx('users').where({ id: dto.user_id, status: 'Open' }).first();
      if (!user)
        throw new BadRequestException({
          message: 'User not found or inactive',
          location: 'user_id',
        });

      const phoneCategory = await trx('phone_categories as pc')
        .select(
          'pc.*',
          this.knex.raw(
            `EXISTS (SELECT 1 FROM phone_categories c WHERE c.parent_id = pc.id AND c.status = 'Open') as has_children`,
          ),
        )
        .where({ 'pc.id': dto.phone_category_id, 'pc.is_active': true, 'pc.status': 'Open' })
        .first();
      if (!phoneCategory)
        throw new BadRequestException({
          message: 'Phone category not found or inactive',
          location: 'phone_category_id',
        });
      if (phoneCategory.has_children)
        throw new BadRequestException({
          message: 'Phone category must not have children',
          location: 'phone_category_id',
        });

      const sort = await getNextSortValue(trx, this.table, { where: { branch_id: branchId } });
      const insertData: Partial<RepairOrder> = {
        user_id: dto.user_id,
        branch_id: branchId,
        phone_category_id: dto.phone_category_id,
        priority: dto.priority || 'Medium',
        status_id: statusId,
        sort,
        delivery_method: 'Self',
        pickup_method: 'Self',
        created_by: admin.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const [order]: RepairOrder[] = await trx(this.table).insert(insertData).returning('*');
      await Promise.all([
        this.helper.insertAssignAdmins(trx, dto, admin, statusId, order.id, branchId, permissions),
        this.helper.insertRentalPhone(trx, dto, admin, statusId, order.id, branchId, permissions),
        this.helper.insertInitialProblems(
          trx,
          dto,
          admin,
          statusId,
          order.id,
          branchId,
          permissions,
        ),
        this.helper.insertFinalProblems(trx, dto, admin, statusId, order.id, branchId, permissions),
        this.helper.insertComments(trx, dto, admin, statusId, order.id, branchId, permissions),
        this.helper.insertPickup(trx, dto, admin, statusId, order.id, branchId, permissions),
        this.helper.insertDelivery(trx, dto, admin, statusId, order.id, branchId, permissions),
      ]);

      await trx.commit();
      await this.redisService.flushByPrefix(`${this.table}:${branchId}`);
      this.logger.log(`Created repair order ${order.id}`);
      return order;
    } catch (err) {
      await trx.rollback();

      if (err instanceof HttpException) {
        throw err;
      }
      this.logger.error(`Failed to create repair order:`);
      throw err;
    }
  }

  async update(
    admin: AdminPayload,
    orderId: string,
    dto: UpdateRepairOrderDto,
  ): Promise<{ message: string }> {
    const trx = await this.knex.transaction();
    try {
      this.logger.log(`Updating repair order ${orderId} by admin ${admin.id}`);
      const order: RepairOrder | undefined = await trx(this.table)
        .where({ id: orderId, status: 'Open' })
        .first();
      if (!order)
        throw new NotFoundException({ message: 'Order not found', location: 'repair_order' });

      const permissions: RepairOrderStatusPermission[] =
        await this.permissionService.findByRolesAndBranch(admin.roles, order.branch_id);
      await this.permissionService.checkPermissionsOrThrow(
        admin.roles,
        order.branch_id,
        order.status_id,
        ['can_update'],
        'repair_order_update',
        permissions,
      );

      const logFields: { key: string; oldVal: any; newVal: any }[] = [];
      const updatedFields: Partial<RepairOrder> = {};

      const fieldsToCheck: (keyof RepairOrder)[] = [
        'user_id',
        'status_id',
        'priority',
        'phone_category_id',
      ];
      for (const field of fieldsToCheck) {
        const dtoFieldValue = dto[field as keyof UpdateRepairOrderDto];
        if (dtoFieldValue !== undefined && dtoFieldValue !== order[field]) {
          updatedFields[field] = dtoFieldValue as any;
          logFields.push({ key: field, oldVal: order[field], newVal: dtoFieldValue });
        }
      }

      if (dto.user_id) {
        await this.permissionService.checkPermissionsOrThrow(
          admin.roles,
          order.branch_id,
          order.status_id,
          ['can_user_manage'],
          'repair_order_user_manage',
          permissions,
        );
        const user = await trx('users').where({ id: dto.user_id, status: 'Open' }).first();
        if (!user)
          throw new BadRequestException({ message: 'User not found', location: 'user_id' });
      }

      if (dto.phone_category_id) {
        const phoneCategory = await trx('phone_categories as pc')
          .select(
            'pc.*',
            this.knex.raw(
              `EXISTS (SELECT 1 FROM phone_categories c WHERE c.parent_id = pc.id AND c.status = 'Open') as has_children`,
            ),
          )
          .where({ 'pc.id': dto.phone_category_id, 'pc.is_active': true, 'pc.status': 'Open' })
          .first();
        if (!phoneCategory)
          throw new BadRequestException({
            message: 'Phone category not found or inactive',
            location: 'phone_category_id',
          });
        if (phoneCategory.has_children)
          throw new BadRequestException({
            message: 'Phone category must not have children',
            location: 'phone_category_id',
          });
      }

      if (Object.keys(updatedFields).length) {
        await trx(this.table)
          .where({ id: orderId })
          .update({ ...updatedFields, updated_at: new Date() });
      }

      await Promise.all([
        this.changeLogger.logMultipleFieldsIfChanged(trx, orderId, logFields, admin.id),
        this.initialProblemUpdater.update(trx, orderId, dto.initial_problems || [], admin),
        this.finalProblemUpdater.update(trx, orderId, dto.final_problems || [], admin),
      ]);

      await trx.commit();
      await this.redisService.flushByPrefix(`${this.table}:${order.branch_id}`);
      this.logger.log(`Updated repair order ${orderId}`);
      return { message: 'Repair order updated successfully' };
    } catch (err) {
      await trx.rollback();
      this.logger.error(`Failed to update repair order ${orderId}`);
      throw err;
    }
  }

  async findAllByAdminBranch(
    admin: AdminPayload,
    branchId: string,
    query: PaginationQuery,
  ): Promise<Record<string, FreshRepairOrder[]>> {
    const { page = 1, limit = 20, sort_by = 'sort', sort_order = 'asc' } = query;
    const offset = (page - 1) * limit;

    this.logger.log(`Fetching repair orders for admin ${admin.id} in branch ${branchId}`);
    const permissions = await this.permissionService.findByRolesAndBranch(admin.roles, branchId);
    const statusIds = permissions.filter((p) => p.can_view).map((p) => p.status_id);
    if (!statusIds.length) return {};

    const cacheKey = `${this.table}:${branchId}:${admin.id}:${sort_by}:${sort_order}:${page}:${limit}`;
    const cached: Record<string, FreshRepairOrder[]> | null = await this.redisService.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for repair orders: ${cacheKey}`);
      return cached;
    }

    const freshOrders = await this.knex<FreshRepairOrder>('repair_orders as ro')
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
        'pc.name_uz as phone_name',
      )
      .where({ 'ro.branch_id': branchId, 'ro.status': 'Open' })
      .whereIn('ro.status_id', statusIds)
      .orderBy('ro.status_id')
      .orderBy(`ro.${sort_by}`, sort_order);

    const result: Record<string, FreshRepairOrder[]> = {};
    for (const statusId of statusIds) {
      const filtered = freshOrders.filter((o) => o.status_id === statusId);
      result[statusId] = filtered.slice(offset, offset + limit);
    }

    await this.redisService.set(cacheKey, result, 300);
    this.logger.log(`Fetched ${freshOrders.length} repair orders`);
    return result;
  }

  async softDelete(admin: AdminPayload, orderId: string): Promise<{ message: string }> {
    const trx = await this.knex.transaction();
    try {
      this.logger.log(`Soft deleting repair order ${orderId} by admin ${admin.id}`);
      const order: RepairOrder | undefined = await trx(this.table)
        .where({ id: orderId, status: 'Open' })
        .first();
      if (!order)
        throw new NotFoundException({
          message: 'Repair order not found or already deleted',
          location: 'repair_order',
        });

      const permissions: RepairOrderStatusPermission[] =
        await this.permissionService.findByRolesAndBranch(admin.roles, order.branch_id);
      await this.permissionService.checkPermissionsOrThrow(
        admin.roles,
        order.branch_id,
        order.status_id,
        ['can_delete'],
        'repair_order_delete',
        permissions,
      );

      await this.changeLogger.logIfChanged(
        trx,
        orderId,
        'status',
        order.status,
        'Deleted',
        admin.id,
      );
      await trx(this.table)
        .where({ id: orderId })
        .update({ status: 'Deleted', updated_at: new Date() });

      await trx.commit();
      await this.redisService.flushByPrefix(`${this.table}:${order.branch_id}`);
      this.logger.log(`Soft deleted repair order ${orderId}`);
      return { message: 'Repair order deleted successfully' };
    } catch (err) {
      await trx.rollback();
      this.logger.error(`Failed to soft delete repair order ${orderId}`);
      throw err;
    }
  }

  async findById(admin: AdminPayload, orderId: string): Promise<RepairOrderDetails> {
    this.logger.log(`Fetching repair order ${orderId} for admin ${admin.id}`);
    const query = loadSQL('repair-orders/queries/find-by-id.sql');
    const result: { rows: RepairOrderDetails[] } = await this.knex.raw(query, { orderId });
    const order = result.rows[0];

    if (!order) throw new NotFoundException('Repair order not found');

    const permissions: RepairOrderStatusPermission[] =
      await this.permissionService.findByRolesAndBranch(admin.roles, order.branch_id);
    await this.permissionService.checkPermissionsOrThrow(
      admin.roles,
      order.branch_id,
      order.status_id,
      ['can_view'],
      'repair_order_view',
      permissions,
    );

    this.logger.log(`Fetched repair order ${orderId}`);
    return order;
  }

  async sendStatusChangeNotification(
    trx: Knex.Transaction,
    orderId: string,
    newStatusId: string,
    changedByAdminId: string,
  ): Promise<void> {
    const order = await trx('repair_orders').where({ id: orderId }).first();
    if (!order) return;

    const permissionedAdmins: RepairOrderStatusPermission[] = await trx(
      'repair_order_status_permissions',
    )
      .select('admin_id', 'role_id')
      .where({ status_id: newStatusId, branch_id: order.branch_id, can_notification: true });

    if (!permissionedAdmins.length) return;

    const now = new Date();
    const notifications = permissionedAdmins.map((a) => ({
      role_id: a.role_id,
      title: 'Buyurtma holati o‘zgardi',
      message: `Buyurtma yangi statusga o'tdi`,
      type: 'info',
      meta: {
        order_id: order.id,
        from_status_id: order.status_id,
        to_status_id: newStatusId,
        changed_by: changedByAdminId,
        action: 'status_changed',
      },
      created_at: now,
      updated_at: now,
    }));

    await trx('notifications').insert(notifications);
    this.logger.log(`Sent notifications for status change of repair order ${orderId}`);
  }

  async move(
    admin: AdminPayload,
    orderId: string,
    dto: MoveRepairOrderDto,
  ): Promise<{ message: string }> {
    const trx = await this.knex.transaction();
    try {
      this.logger.log(`Moving repair order ${orderId} by admin ${admin.id}`);
      const order: RepairOrder | undefined = await trx(this.table)
        .where({ id: orderId, status: 'Open' })
        .first();
      if (!order) throw new NotFoundException('Repair order not found');

      if (dto.status_id !== order.status_id) {
        const transitionExists = await trx('repair_order_status_transitions')
          .where({ from_status_id: order.status_id, to_status_id: dto.status_id })
          .first();
        if (!transitionExists) throw new BadRequestException('Status transition is not allowed');

        await this.sendStatusChangeNotification(trx, orderId, dto.status_id, admin.id);
      }

      const permissions: RepairOrderStatusPermission[] =
        await this.permissionService.findByRolesAndBranch(admin.roles, order.branch_id);
      await this.permissionService.checkPermissionsOrThrow(
        admin.roles,
        order.branch_id,
        order.status_id,
        ['can_change_status'],
        'repair_order_change_status',
        permissions,
      );

      const updates: Partial<RepairOrder> = {};
      const logs: { key: string; oldVal: any; newVal: any }[] = [];

      if (dto.status_id !== order.status_id) {
        updates.status_id = dto.status_id;
        logs.push({ key: 'status_id', oldVal: order.status_id, newVal: dto.status_id });
      }

      if (dto.sort !== order.sort) {
        updates.sort = dto.sort;
        logs.push({ key: 'sort', oldVal: order.sort, newVal: dto.sort });
      }

      if (Object.keys(updates).length) {
        await trx(this.table)
          .where({ id: orderId })
          .update({ ...updates, updated_at: new Date() });
      }

      await this.changeLogger.logMultipleFieldsIfChanged(trx, orderId, logs, admin.id);
      await trx.commit();
      await this.redisService.flushByPrefix(`${this.table}:${order.branch_id}`);
      this.logger.log(`Moved repair order ${orderId}`);
      return { message: 'Repair order moved successfully' };
    } catch (err) {
      await trx.rollback();
      this.logger.error(`Failed to move repair order ${orderId}`);
      throw err;
    }
  }

  async updateSort(
    orderId: string,
    newSort: number,
    admin: AdminPayload,
  ): Promise<{ message: string }> {
    const trx = await this.knex.transaction();
    try {
      this.logger.log(`Updating sort for repair order ${orderId} by admin ${admin.id}`);
      const order: RepairOrder | undefined = await trx(this.table)
        .where({ id: orderId, status: 'Open' })
        .first();
      if (!order)
        throw new NotFoundException({
          message: 'Repair order not found or already deleted',
          location: 'repair_order',
        });

      const permissions: RepairOrderStatusPermission[] =
        await this.permissionService.findByRolesAndBranch(admin.roles, order.branch_id);
      await this.permissionService.checkPermissionsOrThrow(
        admin.roles,
        order.branch_id,
        order.status_id,
        ['can_update'],
        'repair_order_update',
        permissions,
      );

      if (newSort === order.sort) return { message: 'No change needed' };

      if (newSort < order.sort) {
        await trx(this.table)
          .where({ branch_id: order.branch_id, status_id: order.status_id, status: 'Open' })
          .andWhere('sort', '>=', newSort)
          .andWhere('sort', '<', order.sort)
          .update({ sort: this.knex.raw('sort + 1') });
      } else {
        await trx(this.table)
          .where({ branch_id: order.branch_id, status_id: order.status_id, status: 'Open' })
          .andWhere('sort', '<=', newSort)
          .andWhere('sort', '>', order.sort)
          .update({ sort: this.knex.raw('sort - 1') });
      }

      await trx(this.table)
        .where({ id: orderId })
        .update({ sort: newSort, updated_at: new Date() });
      await this.changeLogger.logIfChanged(trx, orderId, 'sort', order.sort, newSort, admin.id);

      await trx.commit();
      await this.redisService.flushByPrefix(`${this.table}:${order.branch_id}`);
      this.logger.log(`Updated sort for repair order ${orderId}`);
      return { message: 'Repair order sort updated successfully' };
    } catch (err) {
      await trx.rollback();
      this.logger.error(`Failed to update sort for repair order ${orderId}`);
      throw err;
    }
  }
}
