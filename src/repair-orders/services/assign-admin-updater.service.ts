import { BadRequestException, Injectable } from '@nestjs/common';
import { Knex } from 'knex';
import { InjectKnex } from 'nestjs-knex';
import { NotificationService } from 'src/notification/notification.service';
import { RepairOrderStatusPermissionsService } from 'src/repair-order-status-permission/repair-order-status-permissions.service';
import { RepairOrderChangeLoggerService } from './repair-order-change-logger.service';
import { RepairOrder } from 'src/common/types/repair-order.interface';
import { RepairOrderStatusPermission } from 'src/common/types/repair-order-status-permssion.interface';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { RedisService } from 'src/common/redis/redis.service';
import { RemoveAdminsDto } from 'src/branches/dto/remove-admins.dto';

@Injectable()
export class AssignAdminUpdaterService {
  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly permissionService: RepairOrderStatusPermissionsService,
    private readonly changeLogger: RepairOrderChangeLoggerService,
    private readonly notificationService: NotificationService,
    private readonly redisService: RedisService,
  ) {}

  private readonly table = 'repair_orders';

  async create(orderId: string, adminIds: string[], admin: AdminPayload): Promise<void> {
    if (!adminIds?.length) return;
    let branchId: string | null = null;
    await this.knex.transaction(async (trx) => {
      const order: RepairOrder | undefined = await trx<RepairOrder>('repair_orders')
        .where({ id: orderId })
        .first();

      if (!order) {
        throw new BadRequestException({
          message: 'Repair order not found',
          location: 'repair_order_id',
        });
      }
      branchId = order.branch_id;

      const allPermissions: RepairOrderStatusPermission[] =
        await this.permissionService.findByRolesAndBranch(admin.roles, order.branch_id);

      await this.permissionService.checkPermissionsOrThrow(
        admin.roles,
        order.branch_id,
        order.status_id,
        ['can_assign_admin'],
        'repair_order_update',
        allPermissions,
      );

      const uniqueIds = [...new Set(adminIds)];

      const existing = await trx('admins').whereIn('id', uniqueIds).pluck('id');
      const notFound = uniqueIds.filter((id) => !existing.includes(id));

      if (notFound.length) {
        throw new BadRequestException({
          message: 'Admin(s) not found',
          location: 'admin_ids',
          missing_ids: notFound,
        });
      }

      const now = new Date();
      const rows = uniqueIds.map((id) => ({
        repair_order_id: orderId,
        admin_id: id,
        created_at: now,
      }));

      await trx('repair_order_assign_admins').insert(rows);

      const notifications = uniqueIds.map((adminId) => ({
        admin_id: adminId,
        title: 'Yangi buyurtma tayinlandi',
        message: 'Sizga yangi repair order biriktirildi.',
        type: 'info',
        meta: {
          order_id: order.id,
          branch_id: order.branch_id,
          assigned_by: admin.id,
          action: 'assigned_to_order',
        },
        created_at: now,
        updated_at: now,
      }));

      await trx('notifications').insert(notifications);

      await this.notificationService.notifyAdmins(trx, uniqueIds, {
        title: 'Yangi buyurtma',
        message: 'Sizga yangi buyurtma biriktirildi.',
        meta: {
          order_id: order.id,
          action: 'assigned_to_order',
        },
      });

      await this.changeLogger.logIfChanged(trx, orderId, 'admin_ids', [], uniqueIds, admin.id);
    });

    if (branchId) {
      await this.redisService.flushByPrefix(`${this.table}:${String(branchId)}`);
    }
  }

  async delete(orderId: string, adminId: string, admin: AdminPayload): Promise<void> {
    let branchId: string | null = null;
    await this.knex.transaction(async (trx) => {
      const order: RepairOrder | undefined = await trx<RepairOrder>('repair_orders')
        .where({ id: orderId })
        .first();

      if (!order) {
        throw new BadRequestException({
          message: 'Repair order not found',
          location: 'repair_order_id',
        });
      }

      branchId = order.branch_id;
      const allPermissions: RepairOrderStatusPermission[] =
        await this.permissionService.findByRolesAndBranch(admin.roles, order.branch_id);

      await this.permissionService.checkPermissionsOrThrow(
        admin.roles,
        order.branch_id,
        order.status_id,
        ['can_assign_admin'],
        'repair_order_update',
        allPermissions,
      );

      const deleted = await trx('repair_order_assign_admins')
        .where({ repair_order_id: orderId, admin_id: adminId })
        .delete();

      if (deleted) {
        await this.changeLogger.logIfChanged(trx, orderId, 'admin_ids', [adminId], [], admin.id);
      }
    });
    if (branchId) {
      await this.redisService.flushByPrefix(`${this.table}:${String(branchId)}`);
    }
  }

  async deleteMany(orderId: string, dto: RemoveAdminsDto, admin: AdminPayload): Promise<void> {
    let branchId: string | null = null;

    await this.knex.transaction(async (trx) => {
      const order: RepairOrder | undefined = await trx<RepairOrder>('repair_orders')
        .where({ id: orderId })
        .first();

      if (!order) {
        throw new BadRequestException({
          message: 'Repair order not found',
          location: 'repair_order_id',
        });
      }
      branchId = order.branch_id;
      const allPermissions: RepairOrderStatusPermission[] =
        await this.permissionService.findByRolesAndBranch(admin.roles, order.branch_id);

      await this.permissionService.checkPermissionsOrThrow(
        admin.roles,
        order.branch_id,
        order.status_id,
        ['can_assign_admin'],
        'repair_order_update',
        allPermissions,
      );

      const deleted = await trx('repair_order_assign_admins')
        .where('repair_order_id', orderId)
        .whereIn('admin_id', dto.admin_ids)
        .delete();

      if (deleted > 0) {
        await this.changeLogger.logIfChanged(
          trx,
          orderId,
          'admin_ids',
          dto.admin_ids,
          [],
          admin.id,
        );

        await this.redisService.flushByPrefix(`${this.table}:${order.branch_id}`);
      }
    });

    if (branchId) {
      await this.redisService.flushByPrefix(`${this.table}:${String(branchId)}`);
    }
  }
}
