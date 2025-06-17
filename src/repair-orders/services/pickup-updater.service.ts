import { Injectable } from "@nestjs/common";
import { RepairOrderStatusPermissionsService } from "src/repair-order-status-permission/repair-order-status-permissions.service";
import { RepairOrderChangeLoggerService } from "./repair-order-change-logger.service";

@Injectable()
export class PickupUpdaterService {
    constructor(
        private readonly permissionService: RepairOrderStatusPermissionsService,
        private readonly changeLogger: RepairOrderChangeLoggerService,
    ) { }

    async update(trx, orderId, pickup, adminId, statusId) {
        if (!pickup) return;

        await this.permissionService.validatePermissionOrThrow(adminId, statusId, 'can_pickup_manage', 'pickup');

        const old = await trx('repair_order_pickups')
            .where({ repair_order_id: orderId })
            .first();

        await trx('repair_order_pickups').where({ repair_order_id: orderId }).delete();

        await trx('repair_order_pickups').insert({
            repair_order_id: orderId,
            lat: pickup.lat,
            long: pickup.long,
            description: pickup.description,
            created_by: adminId,
            created_at: new Date(),
            updated_at: new Date(),
        });

        await this.changeLogger.logIfChanged(trx, orderId, 'pickup', old, pickup, adminId);
    }
}
