import { Injectable } from "@nestjs/common";
import { RepairOrderStatusPermissionsService } from "src/repair-order-status-permission/repair-order-status-permissions.service";
import { RepairOrderChangeLoggerService } from "./repair-order-change-logger.service";

@Injectable()
export class FinalProblemUpdaterService {
    constructor(
        private readonly permissionService: RepairOrderStatusPermissionsService,
        private readonly changeLogger: RepairOrderChangeLoggerService,
    ) { }

    async update(trx, orderId, problems, adminId, statusId) {
        if (!problems) return;

        await this.permissionService.validatePermissionOrThrow(adminId, statusId, 'can_change_final_problems', 'final_problems');

        const old = await trx('repair_order_final_problems')
            .where({ repair_order_id: orderId })
            .select('problem_category_id', 'price', 'estimated_minutes');

        await trx('repair_order_final_problems').where({ repair_order_id: orderId }).delete();

        const rows = problems.map((p) => ({
            repair_order_id: orderId,
            problem_category_id: p.problem_category_id,
            price: p.price,
            estimated_minutes: p.estimated_minutes,
            created_by: adminId,
            created_at: new Date(),
            updated_at: new Date(),
        }));

        await trx('repair_order_final_problems').insert(rows);

        await this.changeLogger.logIfChanged(trx, orderId, 'final_problems', old, problems, adminId);
    }
}
