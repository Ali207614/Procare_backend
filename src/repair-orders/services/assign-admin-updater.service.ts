import { BadRequestException, Injectable } from "@nestjs/common";
import { RepairOrderStatusPermissionsService } from "src/repair-order-status-permission/repair-order-status-permissions.service";
import { RepairOrderChangeLoggerService } from "./repair-order-change-logger.service";

@Injectable()
export class AssignAdminUpdaterService {
    constructor(
        private readonly permissionService: RepairOrderStatusPermissionsService,
        private readonly changeLogger: RepairOrderChangeLoggerService,
    ) { }

    async update(
        trx,
        orderId,
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
            const rows = toAdd.map((id) => ({
                repair_order_id: orderId,
                admin_id: id,
                created_at: new Date(),
            }));
            await trx('repair_order_assign_admins').insert(rows);
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
