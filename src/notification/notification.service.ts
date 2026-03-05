import { Injectable, NotFoundException } from '@nestjs/common';
import type { Knex } from 'knex';
import { InjectKnex } from 'nestjs-knex';
import { FindNotificationsDto } from './dto/find-notification.dto';
import { NotificationGateway } from './notification.gateway';
import {
  BroadcastMessage,
  Notification,
  NotificationPayload,
  RepairNotificationMeta,
} from '../common/types/notification.interface';
import { PaginationResult } from 'src/common/utils/pagination.util';
import { EnumBooleanString } from 'src/roles/dto/find-all-roles.dto';

@Injectable()
export class NotificationService {
  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly gateway: NotificationGateway,
  ) {}

  async notifyAdmins(
    trx: Knex.Transaction | Knex,
    adminIds: string[],
    payload: NotificationPayload,
  ): Promise<void> {
    const now = new Date();

    if (adminIds.length === 0) return;

    const records: Partial<Notification>[] = adminIds.map((adminId: string) => ({
      admin_id: adminId,
      title: payload.title,
      message: payload.message,
      type: payload.type ?? 'info',
      meta: payload.meta || {},
      created_at: now,
      updated_at: now,
    }));

    await trx('notifications').insert(records);

    const message: BroadcastMessage<RepairNotificationMeta> = {
      title: payload.title,
      message: payload.message,
      meta: payload.meta as unknown as RepairNotificationMeta,
    };

    this.gateway.broadcastToAdmins(adminIds, message);
  }

  /**
   * Notifies all admins associated with a specific branch.
   * Persists notifications in DB and broadcasts via branch-specific socket room.
   */
  async notifyBranch(
    trx: Knex.Transaction | Knex,
    branchId: string,
    payload: NotificationPayload,
  ): Promise<void> {
    const now = new Date();

    const admins = await trx('admin_branches')
      .where({ branch_id: branchId })
      .select<{ admin_id: string }[]>('admin_id');

    const adminIds = admins.map((a) => a.admin_id);

    if (adminIds.length === 0) return;

    // 2. Persist notifications for all admins
    const records = adminIds.map((adminId) => ({
      admin_id: adminId,
      title: payload.title,
      message: payload.message,
      type: payload.type ?? 'info',
      meta: payload.meta || {},
      created_at: now,
      updated_at: now,
    }));

    await trx('notifications').insert(records);

    // 3. Broadcast to branch room
    const message: BroadcastMessage<RepairNotificationMeta> = {
      title: payload.title,
      message: payload.message,
      meta: payload.meta as unknown as RepairNotificationMeta,
    };

    this.gateway.broadcastToBranch(branchId, message);
  }

  async findAll(
    adminId: string,
    query: FindNotificationsDto,
  ): Promise<PaginationResult<Notification>> {
    const page = Number(query.offset) || 0;
    const limit = Number(query.limit) || 20;
    const offset = page;

    const baseQuery = this.knex<Notification>('notifications').where({
      admin_id: adminId,
    });

    if (query.is_read === EnumBooleanString.TRUE) {
      void baseQuery.andWhere({ is_read: true });
    } else if (query.is_read === EnumBooleanString.FALSE) {
      void baseQuery.andWhere({ is_read: false });
    }

    const [rows, [{ count }]] = await Promise.all([
      baseQuery.clone().orderBy('created_at', 'desc').offset(offset).limit(limit),
      baseQuery.clone().count<{ count: string }[]>('* as count'),
    ]);

    return {
      rows,
      total: Number(count),
      limit,
      offset,
    };
  }

  async markAsRead(adminId: string, notificationId: string): Promise<{ message: string }> {
    const affected = await this.knex('notifications')
      .update({
        is_read: true,
        read_at: new Date(),
        updated_at: new Date(),
      })
      .where({ id: notificationId, admin_id: adminId, is_read: false });

    if (!affected) {
      throw new NotFoundException({
        message: 'Notification not found or already read',
        location: 'notification_id',
      });
    }

    return { message: 'Notification marked as read' };
  }

  async markAllAsRead(adminId: string): Promise<{ message: string }> {
    await this.knex('notifications')
      .update({
        is_read: true,
        read_at: new Date(),
        updated_at: new Date(),
      })
      .where({ admin_id: adminId, is_read: false });

    return { message: 'All notifications marked as read' };
  }
}
