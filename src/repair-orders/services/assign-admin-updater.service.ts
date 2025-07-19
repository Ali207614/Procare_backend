import { BadRequestException, Injectable } from '@nestjs/common';
import { Knex } from 'knex';
import { InjectKnex } from 'nestjs-knex';
import { NotificationService } from 'src/notification/notification.service';
import { RepairOrderStatusPermissionsService } from 'src/repair-order-status-permission/repair-order-status-permissions.service';
import { RepairOrderChangeLoggerService } from './repair-order-change-logger.service';
import { RepairOrder } from 'src/common/types/repair-order.interface';

@Injectable()
export class AssignAdminUpdaterService {
  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly permissionService: RepairOrderStatusPermissionsService,
    private readonly changeLogger: RepairOrderChangeLoggerService,
    private readonly notificationService: NotificationService,
  ) {}

  async create(orderId: string, adminIds: string[], createdBy: string): Promise<void> {
    if (!adminIds?.length) return;

    const status: RepairOrder | undefined = await this.knex('repair_orders')
      .select('status_id')
      .where({ id: orderId })
      .first();

    if (!status) {
      throw new BadRequestException({
        message: 'Repair order not found',
        location: 'repair_order_id',
      });
    }

    const statusId = status.status_id;

    await this.permissionService.validatePermissionOrThrow(
      createdBy,
      statusId,
      'can_assign_admin',
      'admin_ids',
    );

    const uniqueIds = [...new Set(adminIds)];

    const existing = await this.knex('admins').whereIn('id', uniqueIds).pluck('id');

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
    await this.knex('repair_order_assign_admins').insert(rows);

    const order: RepairOrder | undefined = await this.knex('repair_orders')
      .where({ id: orderId })
      .first();

    if (order) {
      const notifications = uniqueIds.map((adminId) => ({
        admin_id: adminId,
        title: 'Yangi buyurtma tayinlandi',
        message: 'Sizga yangi repair order biriktirildi.',
        type: 'info',
        meta: {
          order_id: order.id,
          branch_id: order.branch_id,
          assigned_by: createdBy,
          action: 'assigned_to_order',
        },
        created_at: now,
        updated_at: now,
      }));

      await this.knex('notifications').insert(notifications);

      await this.notificationService.notifyAdmins(this.knex, uniqueIds, {
        title: 'Yangi buyurtma',
        message: 'Sizga yangi buyurtma biriktirildi.',
        meta: {
          order_id: order.id,
          action: 'assigned_to_order',
        },
      });
    }
  }

  async delete(orderId: string, adminId: string, currentAdminId: string): Promise<void> {
    const status: RepairOrder | undefined = await this.knex('repair_orders')
      .select('status_id')
      .where({ id: orderId })
      .first();

    if (!status) {
      throw new BadRequestException({
        message: 'Repair order not found',
        location: 'repair_order_id',
      });
    }

    const statusId = status.status_id;

    await this.permissionService.validatePermissionOrThrow(
      currentAdminId,
      statusId,
      'can_assign_admin',
      'admin_ids',
    );

    const deleted = await this.knex('repair_order_assign_admins')
      .where({ repair_order_id: orderId, admin_id: adminId })
      .delete();

    if (deleted) {
      await this.changeLogger.logIfChanged(
        this.knex,
        orderId,
        'admin_ids',
        [adminId],
        [],
        currentAdminId,
      );
    }
  }
}
