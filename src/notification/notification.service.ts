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
      meta: payload.meta as RepairNotificationMeta,
    };

    this.gateway.broadcastToAdmins(adminIds, message);
  }

  async findAll(
    adminId: string,
    query: FindNotificationsDto,
  ): Promise<PaginationResult<Notification>> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const offset = (page - 1) * limit;

    const baseQuery = this.knex<Notification>('notifications').where({
      admin_id: adminId,
    });

    if (query.is_read === 'true') {
      void baseQuery.andWhere({ is_read: true });
    } else if (query.is_read === 'false') {
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
