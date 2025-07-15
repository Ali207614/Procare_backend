import { Injectable, NotFoundException } from '@nestjs/common';
import type { Knex } from 'knex';
import { InjectKnex } from 'nestjs-knex';
import { FindNotificationsDto } from './dto/find-notification.dto';
import { NotificationGateway } from './notification.gateway';

@Injectable()
export class NotificationService {
  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly gateway: NotificationGateway,
  ) {}

  async notifyAdmins(trx: Knex.Transaction | Knex, adminIds: string[], payload: any) {
    const now = new Date();

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

    this.gateway.broadcastToAdmins(adminIds, {
      title: payload.title,
      message: payload.message,
      meta: payload.meta,
    });
  }

  async findAll(adminId: string, query: FindNotificationsDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const offset = (page - 1) * limit;

    const q = this.knex('notifications')
      .where({ admin_id: adminId })
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    if (query.is_read === 'true') {
      void q.andWhere({ is_read: true });
    } else if (query.is_read === 'false') {
      void q.andWhere({ is_read: false });
    }

    const data = await q;

    return data;
  }

  async markAsRead(adminId: string, notificationId: string) {
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

  async markAllAsRead(adminId: string) {
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
