import { Injectable } from "@nestjs/common";
import { RepairOrderStatusPermissionsService } from "src/repair-order-status-permission/repair-order-status-permissions.service";
import { RepairOrderChangeLoggerService } from "./repair-order-change-logger.service";

@Injectable()
export class CommentUpdaterService {
    constructor(
        private readonly permissionService: RepairOrderStatusPermissionsService,
        private readonly changeLogger: RepairOrderChangeLoggerService,
    ) { }

    async update(trx, orderId, comments, adminId, statusId) {
        if (!comments?.length) return;

        await this.permissionService.validatePermissionOrThrow(adminId, statusId, 'can_comment', 'comments');

        const rows = comments.map((c) => ({
            repair_order_id: orderId,
            text: c.text,
            status: 'Open',
            created_by: adminId,
            status_by: statusId,
            created_at: new Date(),
            updated_at: new Date(),
        }));

        await trx('repair_order_comments').insert(rows);

        await this.changeLogger.logIfChanged(trx, orderId, 'comments', null, comments, adminId);
    }
}
