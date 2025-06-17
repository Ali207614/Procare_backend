import { Injectable } from "@nestjs/common";
import { RepairOrderStatusPermissionsService } from "src/repair-order-status-permission/repair-order-status-permissions.service";
import { RepairOrderChangeLoggerService } from "./repair-order-change-logger.service";

@Injectable()
export class DeliveryUpdaterService {
    constructor(
        private readonly permissionService: RepairOrderStatusPermissionsService,
        private readonly changeLogger: RepairOrderChangeLoggerService,
    ) { }

    async update(trx, orderId, delivery, adminId, statusId) {
        if (!delivery) return;

        await this.permissionService.validatePermissionOrThrow(adminId, statusId, 'can_delivery_manage', 'delivery');

        const old = await trx('repair_order_deliveries')
            .where({ repair_order_id: orderId })
            .first();

        await trx('repair_order_deliveries').where({ repair_order_id: orderId }).delete();

        await trx('repair_order_deliveries').insert({
            repair_order_id: orderId,
            lat: delivery.lat,
            long: delivery.long,
            description: delivery.description,
            created_by: adminId,
            created_at: new Date(),
            updated_at: new Date(),
        });

        await this.changeLogger.logIfChanged(trx, orderId, 'delivery', old, delivery, adminId);
    }
}
