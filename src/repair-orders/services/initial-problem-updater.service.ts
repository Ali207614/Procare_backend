import { BadRequestException, Injectable } from '@nestjs/common';
import { RepairOrderStatusPermissionsService } from 'src/repair-order-status-permission/repair-order-status-permissions.service';
import { RepairOrderChangeLoggerService } from './repair-order-change-logger.service';
import { Knex } from 'knex';
import { RepairOrderStatusPermission } from 'src/common/types/repair-order-status-permssion.interface';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { RepairOrder } from 'src/common/types/repair-order.interface';

interface PartInput {
  id: string;
  part_price: number;
  quantity: number;
}

interface ProblemInput {
  problem_category_id: string;
  price: number;
  estimated_minutes: number;
  parts?: PartInput[];
}

interface ExistingProblem {
  problem_category_id: string;
  price: string;
  estimated_minutes: number;
}

@Injectable()
export class InitialProblemUpdaterService {
  constructor(
    private readonly permissionService: RepairOrderStatusPermissionsService,
    private readonly changeLogger: RepairOrderChangeLoggerService,
  ) {}

  async update(
    trx: Knex.Transaction,
    orderId: string,
    problems: ProblemInput[],
    admin: AdminPayload,
  ): Promise<void> {
    if (!problems?.length) return;

    const order: RepairOrder | undefined = await trx('repair_orders')
      .where({ id: orderId })
      .first();

    if (!order) {
      throw new BadRequestException({
        message: 'Repair order not found',
        location: 'order_id',
      });
    }

    const allPermissions: RepairOrderStatusPermission[] =
      await this.permissionService.findByRolesAndBranch(admin.roles, order.branch_id);
    await this.permissionService.checkPermissionsOrThrow(
      admin.roles,
      order.branch_id,
      order.status_id,
      ['can_change_final_problems'],
      'repair_order_delivery',
      allPermissions,
    );

    const phoneCategoryId = order.phone_category_id;
    const problemIds = problems.map((p) => p.problem_category_id);

    const rootRows = await trx
      .withRecursive('problem_path', (qb) => {
        void qb
          .select('id', 'parent_id')
          .from('problem_categories')
          .whereIn('id', problemIds)
          .unionAll(function () {
            void this.select('p.id', 'p.parent_id')
              .from('problem_categories as p')
              .join('problem_path as pp', 'pp.parent_id', 'p.id');
          });
      })
      .select<{ id: string }[]>('id')
      .from('problem_path')
      .whereNull('parent_id');

    const rootProblemIds = rootRows.map((r) => r.id);
    const allowed: string[] = await trx('phone_problem_mappings')
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

    await trx('repair_order_initial_problems').where({ repair_order_id: orderId }).delete();
    await trx('repair_order_parts').where({ repair_order_id: orderId }).delete(); // or restrict to initial_problem_ids later

    const now = new Date();

    const rows = problems.map((p) => ({
      repair_order_id: orderId,
      problem_category_id: p.problem_category_id,
      price: p.price,
      estimated_minutes: p.estimated_minutes,
      created_by: admin.id,
      created_at: now,
      updated_at: now,
    }));

    const inserted = await trx('repair_order_initial_problems')
      .insert(rows)
      .returning(['id', 'problem_category_id']);

    const problemCategoryToIdMap = Object.fromEntries(
      inserted.map((row) => [row.problem_category_id, row.id]),
    );

    const allParts = problems.flatMap((p) => p.parts || []);
    const allPartIds = [...new Set(allParts.map((p) => p.id))];

    const partRows = await trx('repair_parts')
      .whereIn('id', allPartIds)
      .select('id', 'problem_category_id');

    const partMap = Object.fromEntries(partRows.map((r) => [r.id, r.problem_category_id]));

    const duplicateParts = problems.flatMap((p) => {
      const seen = new Set<string>();
      return (p.parts || []).filter((pt) => {
        const key = `${p.problem_category_id}:${pt.id}`;
        if (seen.has(key)) return true;
        seen.add(key);
        return false;
      });
    });

    if (duplicateParts.length > 0) {
      throw new BadRequestException({
        message: 'Duplicate parts found in one or more problems',
        location: 'initial_problems.parts',
      });
    }

    const invalidParts = problems.flatMap((p) =>
      (p.parts || []).filter((pt) => partMap[pt.id] !== p.problem_category_id).map((pt) => pt.id),
    );

    if (invalidParts.length > 0) {
      throw new BadRequestException({
        message: 'Some parts do not belong to the specified problem category',
        location: 'initial_problems.parts',
        invalid_part_ids: [...new Set(invalidParts)],
      });
    }

    const partRowsToInsert = problems.flatMap((p) =>
      (p.parts || []).map((pt) => ({
        repair_order_id: orderId,
        repair_order_initial_problem_id: problemCategoryToIdMap[p.problem_category_id],
        repair_order_final_problem_id: null,
        repair_part_id: pt.id,
        quantity: pt.quantity,
        part_price: pt.part_price,
        created_by: admin.id,
        created_at: now,
        updated_at: now,
      })),
    );

    if (partRowsToInsert.length > 0) {
      await trx('repair_order_parts').insert(partRowsToInsert);
    }

    const old: ExistingProblem[] = await trx('repair_order_initial_problems')
      .where({ repair_order_id: orderId })
      .select('problem_category_id', 'price', 'estimated_minutes');

    await this.changeLogger.logIfChanged(trx, orderId, 'initial_problems', old, problems, admin.id);
  }
}
