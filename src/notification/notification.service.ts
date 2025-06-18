import { Injectable } from '@nestjs/common';
import type { Knex } from 'knex';
import { NotificationGateway } from './notification.gateway';

@Injectable()
export class NotificationService {
    constructor(
        private readonly knex: Knex,
        private readonly gateway: NotificationGateway,
    ) { }

    async notifyAdmins(trx: Knex.Transaction, adminIds: string[], payload: any) {
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
}
