import { BadRequestException, Injectable } from "@nestjs/common";
import { RepairOrderStatusPermissionsService } from "src/repair-order-status-permission/repair-order-status-permissions.service";
import { RepairOrderChangeLoggerService } from "./repair-order-change-logger.service";

@Injectable()
export class InitialProblemUpdaterService {
    constructor(
        private readonly permissionService: RepairOrderStatusPermissionsService,
        private readonly changeLogger: RepairOrderChangeLoggerService,
    ) { }

    async update(trx, orderId, problems, adminId, statusId, phoneCategoryId: string) {
        if (!problems?.length) return;

        await this.permissionService.validatePermissionOrThrow(
            adminId,
            statusId,
            'can_change_initial_problems',
            'initial_problems',
        );

        const problemIds = problems.map(p => p.problem_category_id);

        const allowed = await trx('phone_problem_mappings')
            .where({ phone_category_id: phoneCategoryId })
            .whereIn('problem_category_id', problemIds)
            .pluck('problem_category_id');

        const invalid = problemIds.filter(id => !allowed.includes(id));
        if (invalid.length) {
            throw new BadRequestException({
                message: 'Some initial problems are not allowed for this phone category',
                location: 'initial_problems',
                invalid_problem_ids: invalid,
            });
        }

        const old = await trx('repair_order_initial_problems')
            .where({ repair_order_id: orderId })
            .select('problem_category_id', 'price', 'estimated_minutes');

        await trx('repair_order_initial_problems')
            .where({ repair_order_id: orderId })
            .delete();

        const rows = problems.map(p => ({
            repair_order_id: orderId,
            problem_category_id: p.problem_category_id,
            price: p.price,
            estimated_minutes: p.estimated_minutes,
            created_by: adminId,
            created_at: new Date(),
            updated_at: new Date(),
        }));

        await trx('repair_order_initial_problems').insert(rows);

        await this.changeLogger.logIfChanged(
            trx,
            orderId,
            'initial_problems',
            old,
            problems,
            adminId,
        );
    }
}
