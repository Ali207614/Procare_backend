import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectKnex } from 'nestjs-knex';
import { getNextSortValue } from 'src/common/utils/sort.util';
import { RepairOrderStatusPermissionsService } from 'src/repair-order-status-permission/repair-order-status-permissions.service';
import { CreateRepairOrderDto } from './dto/create-repair-order.dto';
import type { Knex } from 'knex';
import { RepairOrderCreateHelperService } from './services/repair-order-create-helper.service';
import { RepairOrderChangeLoggerService } from './services/repair-order-change-logger.service';
import { InitialProblemUpdaterService } from './services/initial-problem-updater.service';
import { FinalProblemUpdaterService } from './services/final-problem-updater.service';
import { UpdateRepairOrderDto } from './dto/update-repair-order.dto';
import { PaginationQuery } from 'src/common/types/pagination-query.interface';
import { RedisService } from 'src/common/redis/redis.service';
import { loadSQL } from 'src/common/utils/sql-loader.util';
import { MoveRepairOrderDto } from './dto/move-repair-order.dto';
import {
  FreshRepairOrder,
  RepairOrder,
  RepairOrderDetails,
} from 'src/common/types/repair-order.interface';
import { RepairOrderStatusPermission } from 'src/common/types/repair-order-status-permssion.interface';
import { PhoneCategoryWithMeta } from 'src/common/types/phone-category.interface';
import { AdminPayload } from 'src/common/types/admin-payload.interface';

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
  ) {}

  async create(
    admin: AdminPayload,
    branchId: string,
    statusId: string,
    dto: CreateRepairOrderDto,
  ): Promise<RepairOrder> {
    const trx = await this.knex.transaction();

    try {
      const allPermissions: RepairOrderStatusPermission[] =
        await this.permissionService.findByRolesAndBranch(admin.roles, branchId);
      await this.permissionService.checkPermissionsOrThrow(
        admin.roles,
        branchId,
        statusId,
        ['can_add'],
        'repair_order_permission',
        allPermissions,
      );

      const user = await this.knex('users')
        .where({ id: dto.user_id })
        .whereNot({ status: 'Deleted' })
        .first();
      if (!user) {
        throw new BadRequestException({
          message: 'User not found or inactive',
          location: 'user_id',
        });
      }

      const result: PhoneCategoryWithMeta | undefined = await this.knex<PhoneCategoryWithMeta>(
        'phone_categories as pc',
      )
        .select(
          'pc.*',
          this.knex.raw(`EXISTS (
      SELECT 1 FROM phone_categories c
      WHERE c.parent_id = pc.id AND c.status = 'Open'
    ) as has_children`),
        )
        .where('pc.id', dto.phone_category_id)
        .andWhere('pc.is_active', true)
        .andWhere('pc.status', 'Open')
        .first();

      if (!result) {
        throw new BadRequestException({
          message: 'Phone category not found or inactive',
          location: 'phone_category_id',
        });
      }

      if (result?.has_children) {
        throw new BadRequestException({
          message: 'You must select the last phone category (no more children)',
          location: 'phone_category_id',
        });
      }

      const sort = await getNextSortValue(this.knex, this.table, {
        where: { branch_id: branchId },
      });

      const insertdata: Partial<RepairOrder> = {
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

      const insertedData: RepairOrder[] = await trx(this.table).insert(insertdata).returning('*');

      const order: RepairOrder = insertedData[0];

      await this.helper.insertAssignAdmins(
        trx,
        dto,
        admin,
        statusId,
        order.id,
        branchId,
        allPermissions,
      );
      await this.helper.insertRentalPhone(
        trx,
        dto,
        admin,
        statusId,
        order.id,
        branchId,
        allPermissions,
      );
      await this.helper.insertInitialProblems(
        trx,
        dto,
        admin,
        statusId,
        order.id,
        branchId,
        allPermissions,
      );
      await this.helper.insertFinalProblems(
        trx,
        dto,
        admin,
        statusId,
        order.id,
        branchId,
        allPermissions,
      );
      await this.helper.insertComments(
        trx,
        dto,
        admin,
        statusId,
        order.id,
        branchId,
        allPermissions,
      );
      await this.helper.insertPickup(trx, dto, admin, statusId, order.id, branchId, allPermissions);
      await this.helper.insertDelivery(
        trx,
        dto,
        admin,
        statusId,
        order.id,
        branchId,
        allPermissions,
      );

      await trx.commit();
      await this.redisService.flushByPrefix(`${this.table}:${branchId}`);

      return order;
    } catch (err) {
      await trx.rollback();
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
      const order: RepairOrder | undefined = await trx(this.table)
        .where({ id: orderId, status: 'Open' })
        .first();
      if (!order) {
        throw new NotFoundException({
          message: 'Repair order not found',
          location: 'repair_order_id',
        });
      }

      const statusId = order.status_id;
      const allPermissions: RepairOrderStatusPermission[] =
        await this.permissionService.findByRolesAndBranch(admin.roles, order.branch_id);
      await this.permissionService.checkPermissionsOrThrow(
        admin.roles,
        order.branch_id,
        statusId,
        ['can_update'],
        'repair_order_update',
        allPermissions,
      );

      const logFields = [];
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
          logFields.push({
            key: field,
            oldVal: order[field],
            newVal: dtoFieldValue,
          });
        }
      }

      if (dto.user_id) {
        await this.permissionService.checkPermissionsOrThrow(
          admin.roles,
          order.branch_id,
          statusId,
          ['can_user_manage'],
          'repair_order_user_manage',
          allPermissions,
        );
        const user = await this.knex('users')
          .where({ id: dto.user_id })
          .whereNot({ status: 'Deleted' })
          .first();
        if (!user) {
          throw new BadRequestException({
            message: 'User not found or inactive',
            location: 'user_id',
          });
        }
      }

      if (dto.phone_category_id) {
        const result: PhoneCategoryWithMeta | undefined = await this.knex('phone_categories as pc')
          .select(
            'pc.*',
            this.knex.raw(`EXISTS (
            SELECT 1 FROM phone_categories c
            WHERE c.parent_id = pc.id AND c.status = 'Open'
          ) as has_children`),
          )
          .where('pc.id', dto.phone_category_id)
          .andWhere('pc.is_active', true)
          .andWhere('pc.status', 'Open')
          .first();

        if (!result) {
          throw new BadRequestException({
            message: 'Phone category not found or inactive',
            location: 'phone_category_id',
          });
        }

        if (result.has_children) {
          throw new BadRequestException({
            message: 'You must select the last phone category (no more children)',
            location: 'phone_category_id',
          });
        }
      }

      if (Object.keys(updatedFields).length) {
        await trx(this.table)
          .update({ ...updatedFields, updated_at: new Date().toISOString() })
          .where({ id: orderId });
      }

      await this.changeLogger.logMultipleFieldsIfChanged(trx, orderId, logFields, admin.id);

      await this.initialProblemUpdater.update(trx, orderId, dto.initial_problems || [], admin);

      await this.finalProblemUpdater.update(trx, orderId, dto.final_problems || [], admin);

      await trx.commit();
      await this.redisService.flushByPrefix(`${this.table}:${order.branch_id}`);

      return { message: 'Repair order updated successfully' };
    } catch (err) {
      await trx.rollback();
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

    const permissions: RepairOrderStatusPermission[] =
      await this.permissionService.findByRolesAndBranch(admin.roles, branchId);
    const statusIds: string[] = permissions.filter((p) => p.can_view).map((p) => p.status_id);
    if (!statusIds.length) return {};

    const allCacheKeys = statusIds.map(
      (statusId) =>
        `${this.table}:${branchId}:${admin.id}:${statusId}:${sort_by}:${sort_order}:${page}:${limit}`,
    );

    const cachedResults = await this.redisService.mget(...allCacheKeys);

    const result: Record<string, FreshRepairOrder[]> = {};
    const missingStatusIds: string[] = [];

    statusIds.forEach((statusId: string, index: number): void => {
      const cached = cachedResults[index];

      if (cached !== null && cached !== undefined) {
        result[statusId] = cached as FreshRepairOrder[]; // ✅ Type explicitly
      } else {
        missingStatusIds.push(statusId);
      }
    });

    if (missingStatusIds.length) {
      const freshOrders: FreshRepairOrder[] = await this.knex<FreshRepairOrder>(
        'repair_orders as ro',
      )
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
        .where('ro.branch_id', branchId)
        .where('ro.branch_id', branchId)
        .whereIn('ro.status_id', missingStatusIds)
        .andWhere('ro.status', '!=', 'Deleted')
        .orderBy('ro.status_id')
        .orderBy(`ro.${sort_by}`, sort_order);

      for (const statusId of missingStatusIds) {
        const filtered: FreshRepairOrder[] = freshOrders.filter(
          (o: FreshRepairOrder): boolean => o.status_id === statusId,
        );
        const paginated = filtered.slice(offset, offset + limit);

        const cacheKey = `${this.table}:${branchId}:${admin.id}:${statusId}:${sort_by}:${sort_order}:${page}:${limit}`;
        await this.redisService.set(cacheKey, paginated, 300);

        result[statusId] = paginated;
      }
    }

    return result;
  }

  async softDelete(admin: AdminPayload, orderId: string): Promise<{ message: string }> {
    const trx = await this.knex.transaction();

    try {
      const order: RepairOrder | undefined = await trx(this.table)
        .where({ id: orderId, status: 'Open' })
        .first();

      if (!order) {
        throw new NotFoundException({
          message: 'Repair order not found or already deleted',
          location: 'repair_order_id',
        });
      }

      const allPermissions: RepairOrderStatusPermission[] =
        await this.permissionService.findByRolesAndBranch(admin.roles, order.branch_id);
      await this.permissionService.checkPermissionsOrThrow(
        admin.roles,
        order.branch_id,
        order.status_id,
        ['can_delete'],
        'repair_order_delete',
        allPermissions,
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
        .update({ status: 'Deleted', updated_at: new Date() })
        .where({ id: orderId });

      await trx.commit();

      await this.redisService.flushByPrefix(`${this.table}:${order.branch_id}`);

      return { message: 'Repair order deleted (soft) successfully' };
    } catch (err) {
      await trx.rollback();
      throw err;
    }
  }

  async findById(admin: AdminPayload, orderId: string): Promise<RepairOrderDetails> {
    const query: string = loadSQL('repair-orders/queries/find-by-id.sql');

    const result: { rows: RepairOrderDetails[] } = await this.knex.raw(query, { orderId });
    const order = result.rows[0];

    if (!order) {
      throw new NotFoundException({
        message: 'Repair order not found',
        location: 'repair_order_id',
      });
    }
    const allPermissions: RepairOrderStatusPermission[] =
      await this.permissionService.findByRolesAndBranch(admin.roles, order.branch_id);
    await this.permissionService.checkPermissionsOrThrow(
      admin.roles,
      order.branch_id,
      order.status_id,
      ['can_view'],
      'repair_order_view',
      allPermissions,
    );

    return order;
  }

  async sendStatusChangeNotification(
    trx: Knex.Transaction,
    orderId: string,
    newStatusId: string,
    changedByAdminId: string,
  ): Promise<void> {
    const order: RepairOrder | undefined = await trx('repair_orders')
      .where({ id: orderId })
      .first();
    if (!order) return;

    const permissionedAdmins: RepairOrderStatusPermission[] = await trx(
      'repair_order_status_permissions',
    )
      .select('admin_id')
      .where({
        status_id: newStatusId,
        branch_id: order.branch_id,
        can_notification: true,
      });

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
  }

  async move(
    admin: AdminPayload,
    orderId: string,
    dto: MoveRepairOrderDto,
  ): Promise<{ message: string }> {
    const trx = await this.knex.transaction();

    try {
      const order: RepairOrder | undefined = await trx(this.table)
        .where({ id: orderId, status: 'Open' })
        .first();
      if (!order) {
        throw new NotFoundException({
          message: 'Repair order not found',
          location: 'repair_order_id',
        });
      }

      if (dto.status_id !== order.status_id) {
        const transitionExists = await trx('repair_order_status_transitions')
          .where({
            from_status_id: order.status_id,
            to_status_id: dto.status_id,
          })
          .first();

        if (!transitionExists) {
          throw new BadRequestException({
            message: 'Status transition is not allowed',
            location: 'status_id',
          });
        }

        await this.sendStatusChangeNotification(trx, orderId, dto.status_id, admin.id);
      }

      const allPermissions: RepairOrderStatusPermission[] =
        await this.permissionService.findByRolesAndBranch(admin.roles, order.branch_id);
      await this.permissionService.checkPermissionsOrThrow(
        admin.roles,
        order.branch_id,
        order.status_id,
        ['can_change_status'],
        'repair_order_change_status',
        allPermissions,
      );

      const updates: Partial<typeof order> = {};
      const logs = [];

      if (dto.status_id !== order.status_id) {
        updates.status_id = dto.status_id;
        logs.push({ key: 'status_id', oldVal: order.status_id, newVal: dto.status_id });
      }

      if (dto.sort !== order.sort) {
        updates.sort = dto.sort;
        logs.push({ key: 'sort', oldVal: order.sort, newVal: dto.sort });
      }

      if (Object.keys(updates).length) {
        updates.updated_at = new Date().toISOString();
        await trx(this.table).update(updates).where({ id: orderId });
      }

      await this.changeLogger.logMultipleFieldsIfChanged(trx, orderId, logs, admin.id);

      await trx.commit();
      await this.redisService.flushByPrefix(`${this.table}:${order.branch_id}`);

      return { message: 'Repair order moved successfully' };
    } catch (err) {
      await trx.rollback();
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
      const order: RepairOrder | undefined = await trx('repair_orders')
        .where({ id: orderId, status: 'Open' })
        .first();

      if (!order) {
        throw new NotFoundException({
          message: 'Repair order not found or inactive',
          location: 'repair_order_id',
        });
      }

      const allPermissions: RepairOrderStatusPermission[] =
        await this.permissionService.findByRolesAndBranch(admin.roles, order.branch_id);
      await this.permissionService.checkPermissionsOrThrow(
        admin.roles,
        order.branch_id,
        order.status_id,
        ['can_update'],
        'repair_order_update',
        allPermissions,
      );

      const currentSort = order.sort;
      const branchId = order.branch_id;
      const statusId = order.status_id;

      if (newSort === currentSort) {
        return { message: 'No change needed' };
      }

      if (newSort < currentSort) {
        await trx('repair_orders')
          .where({ branch_id: branchId, status_id: statusId })
          .andWhere('sort', '>=', newSort)
          .andWhere('sort', '<', currentSort)
          .andWhere('status', 'Open')
          .update({ sort: this.knex.raw('sort + 1') });
      } else {
        await trx('repair_orders')
          .where({ branch_id: branchId, status_id: statusId })
          .andWhere('sort', '<=', newSort)
          .andWhere('sort', '>', currentSort)
          .andWhere('status', 'Open')
          .update({ sort: this.knex.raw('sort - 1') });
      }

      await trx('repair_orders').where({ id: orderId }).update({
        sort: newSort,
        updated_at: new Date(),
      });

      await this.changeLogger.logIfChanged(trx, orderId, 'sort', currentSort, newSort, admin.id);

      await trx.commit();

      await this.redisService.flushByPrefix(`${this.table}:${branchId}`);

      return { message: 'Repair order sort updated successfully' };
    } catch (err) {
      await trx.rollback();
      throw err;
    }
  }
}
