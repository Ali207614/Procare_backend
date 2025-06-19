import { BadRequestException, Injectable } from "@nestjs/common";
import { NotificationService } from "src/notification/notification.service";
import { RepairOrderStatusPermissionsService } from "src/repair-order-status-permission/repair-order-status-permissions.service";
import { RepairOrderChangeLoggerService } from "./repair-order-change-logger.service";

@Injectable()
export class AssignAdminUpdaterService {
    constructor(
        private readonly permissionService: RepairOrderStatusPermissionsService,
        private readonly changeLogger: RepairOrderChangeLoggerService,
        private readonly notificationService: NotificationService
    ) { }

    async update(
        trx,
        orderId: string,
        newAdminIds: string[] | undefined,
        adminId: string,
        statusId: string,
    ) {
        if (!newAdminIds) return;

        await this.permissionService.validatePermissionOrThrow(adminId, statusId, 'can_assign_admin', 'admin_ids');

        const uniqueAdminIds = [...new Set(newAdminIds)];

        const existing = await trx('admins')
            .whereIn('id', uniqueAdminIds)
            .pluck('id');

        const missing = uniqueAdminIds.filter(id => !existing.includes(id));
        if (missing.length) {
            throw new BadRequestException({
                message: 'Some admins not found',
                location: 'admin_ids',
                missing_ids: missing,
            });
        }

        const oldAdminIds = await trx('repair_order_assign_admins')
            .where({ repair_order_id: orderId })
            .pluck('admin_id');

        const toDelete = oldAdminIds.filter((id) => !uniqueAdminIds.includes(id));
        const toAdd = uniqueAdminIds.filter((id) => !oldAdminIds.includes(id));

        if (toDelete.length) {
            await trx('repair_order_assign_admins')
                .where({ repair_order_id: orderId })
                .whereIn('admin_id', toDelete)
                .delete();
        }

        if (toAdd.length) {
            const now = new Date();

            const rows = toAdd.map((id) => ({
                repair_order_id: orderId,
                admin_id: id,
                created_at: now,
            }));
            await trx('repair_order_assign_admins').insert(rows);

            const order = await trx('repair_orders')
                .where({ id: orderId })
                .first();

            if (order) {
                const notifications = toAdd.map((newAdminId) => ({
                    admin_id: newAdminId,
                    title: 'Yangi buyurtma tayinlandi',
                    message: 'Sizga yangi repair order biriktirildi.',
                    type: 'info',
                    meta: {
                        order_id: order.id,
                        branch_id: order.branch_id,
                        assigned_by: adminId,
                        action: 'assigned_to_order',
                    },
                    created_at: now,
                    updated_at: now,
                }));

                await trx('notifications').insert(notifications);

                await this.notificationService.notifyAdmins(trx, toAdd, {
                    title: 'Yangi buyurtma',
                    message: 'Sizga yangi buyurtma biriktirildi.',
                    meta: {
                        order_id: order.id,
                        action: 'assigned_to_order',
                    },
                });
            }
        }

        await this.changeLogger.logIfChanged(
            trx,
            orderId,
            'admin_ids',
            oldAdminIds.sort(),
            uniqueAdminIds.sort(),
            adminId,
        );
    }
}
