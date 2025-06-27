import { BadRequestException, Injectable } from '@nestjs/common';
import { RepairOrderStatusPermissionsService } from 'src/repair-order-status-permission/repair-order-status-permissions.service';
import { RepairOrderChangeLoggerService } from './repair-order-change-logger.service';

@Injectable()
export class InitialProblemUpdaterService {
  constructor(
    private readonly permissionService: RepairOrderStatusPermissionsService,
    private readonly changeLogger: RepairOrderChangeLoggerService,
  ) {}

  async update(trx, orderId, problems, adminId, statusId) {
    if (!problems?.length) return;

    await this.permissionService.validatePermissionOrThrow(
      adminId,
      statusId,
      'can_change_initial_problems',
      'initial_problems',
    );

    const order = await trx('repair_orders')
      .select('phone_category_id')
      .where({ id: orderId })
      .first();

    if (!order) {
      throw new BadRequestException({
        message: 'Repair order not found',
        location: 'order_id',
      });
    }

    const phoneCategoryId = order.phone_category_id;
    const problemIds = problems.map((p) => p.problem_category_id);

    const rootRows = await trx
      .withRecursive('problem_path', (qb) => {
        qb.select('id', 'parent_id')
          .from('problem_categories')
          .whereIn('id', problemIds)
          .unionAll(function () {
            this.select('p.id', 'p.parent_id')
              .from('problem_categories as p')
              .join('problem_path as pp', 'pp.parent_id', 'p.id');
          });
      })
      .select('id')
      .from('problem_path')
      .whereNull('parent_id');

    const rootProblemIds = rootRows.map((r) => r.id);

    const allowed = await trx('phone_problem_mappings')
      .where({ phone_category_id: phoneCategoryId })
      .whereIn('problem_category_id', rootProblemIds)
      .pluck('problem_category_id');

    const invalid = rootProblemIds.filter((id) => !allowed.includes(id));
    if (invalid.length) {
      throw new BadRequestException({
        message: 'Some problems are not allowed for this phone category',
        location: 'initial_problems',
      });
    }

    const old = await trx('repair_order_initial_problems')
      .where({ repair_order_id: orderId })
      .select('problem_category_id', 'price', 'estimated_minutes');

    await trx('repair_order_initial_problems').where({ repair_order_id: orderId }).delete();

    const rows = problems.map((p) => ({
      repair_order_id: orderId,
      problem_category_id: p.problem_category_id,
      price: p.price,
      estimated_minutes: p.estimated_minutes,
      created_by: adminId,
      created_at: new Date(),
      updated_at: new Date(),
    }));

    await trx('repair_order_initial_problems').insert(rows);

    await this.changeLogger.logIfChanged(trx, orderId, 'initial_problems', old, problems, adminId);
  }
}
