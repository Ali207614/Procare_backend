import { BadRequestException, Injectable } from '@nestjs/common';
import { Knex } from 'knex';
import { RepairOrderStatusPermissionsService } from 'src/repair-order-status-permission/repair-order-status-permissions.service';
import { RepairOrderChangeLoggerService } from './repair-order-change-logger.service';
import { RepairOrder } from 'src/common/types/repair-order.interface';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { RepairOrderStatusPermission } from 'src/common/types/repair-order-status-permssion.interface';

interface PartInput {
  id: string;
  part_price: number;
  quantity: number;
}

interface FinalProblemInput {
  problem_category_id: string;
  price: number;
  estimated_minutes: number;
  parts?: PartInput[];
}

interface ExistingFinalProblem {
  id?: string;
  problem_category_id: string;
  price: string;
  estimated_minutes: number;
  parts?: Array<{
    repair_part_id: string;
    quantity: number;
    part_price: string;
  }>;
}

@Injectable()
export class FinalProblemUpdaterService {
  constructor(
    private readonly permissionService: RepairOrderStatusPermissionsService,
    private readonly changeLogger: RepairOrderChangeLoggerService,
  ) {}

  async update(
    trx: Knex.Transaction,
    orderId: string,
    problems: FinalProblemInput[] | undefined,
    admin: AdminPayload,
  ): Promise<void> {
    if (problems === undefined) return;

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

    if (problems.length === 0) {
      const old = await this.getProblemSnapshot(trx, orderId);

      await trx('repair_order_final_problems').where({ repair_order_id: orderId }).delete();
      await trx('repair_order_parts')
        .where({ repair_order_id: orderId })
        .whereNotNull('repair_order_final_problem_id')
        .delete();

      await this.changeLogger.logIfChanged(trx, orderId, 'final_problems', old, [], admin.id);
      return;
    }

    const phoneCategoryId = order.phone_category_id;
    if (!phoneCategoryId) {
      throw new BadRequestException({
        message: 'Problems cannot be added to a repair order without a phone category',
        location: 'final_problems',
      });
    }
    const problemIds = problems.map((p) => p.problem_category_id);

    const existingCategories = await trx('problem_categories')
      .whereIn('id', problemIds)
      .andWhere({ status: 'Open', is_active: true })
      .select<{ id: string }[]>('id');

    if (existingCategories.length !== problemIds.length) {
      const existingIds = existingCategories.map((c) => c.id);
      const missing = problemIds.filter((id) => !existingIds.includes(id));
      throw new BadRequestException({
        message: 'Some final problem categories are not found or inactive',
        location: 'final_problems',
        missing_ids: missing,
      });
    }

    const pathRows = await trx
      .withRecursive('problem_path', (qb) => {
        void qb
          .select('id', 'parent_id', 'id as start_id')
          .from('problem_categories')
          .whereIn('id', problemIds)
          .unionAll(function () {
            void this.select('p.id', 'p.parent_id', 'pp.start_id')
              .from('problem_categories as p')
              .join('problem_path as pp', 'pp.parent_id', 'p.id');
          });
      })
      .select<{ id: string; start_id: string }[]>('id', 'start_id')
      .from('problem_path');

    const mappedCategoryIds: string[] = await trx('phone_problem_mappings')
      .where({ phone_category_id: phoneCategoryId })
      .pluck('problem_category_id');

    const allowedStartIds = new Set(
      pathRows.filter((row) => mappedCategoryIds.includes(row.id)).map((row) => row.start_id),
    );

    const invalid = problemIds.filter((id) => !allowedStartIds.has(id));
    if (invalid.length) {
      throw new BadRequestException({
        message: 'Some final problems are not allowed for this phone category',
        location: 'final_problems',
        invalid_problem_ids: invalid,
      });
    }

    const old = await this.getProblemSnapshot(trx, orderId);

    // Delete old problems and parts
    await trx('repair_order_final_problems').where({ repair_order_id: orderId }).delete();
    await trx('repair_order_parts')
      .where({ repair_order_id: orderId })
      .whereNotNull('repair_order_final_problem_id')
      .delete();

    const now = new Date();

    // Insert new problems
    const rows = problems.map((p) => ({
      repair_order_id: orderId,
      problem_category_id: p.problem_category_id,
      price: p.price,
      estimated_minutes: p.estimated_minutes,
      created_by: admin.id,
      created_at: now,
      updated_at: now,
    }));

    const inserted = await trx('repair_order_final_problems')
      .insert(rows)
      .returning(['id', 'problem_category_id']);

    const problemCategoryToIdMap = Object.fromEntries(
      inserted.map((row) => [row.problem_category_id, row.id]),
    );

    // Validate parts
    const allParts = problems.flatMap((p) => p.parts || []);
    const allPartIds = [...new Set(allParts.map((p) => p.id))];

    if (allPartIds.length > 0) {
      const partAssignments = await trx('repair_part_assignments')
        .whereIn('repair_part_id', allPartIds)
        .select('repair_part_id', 'problem_category_id');

      const allowedPartSet = new Set(
        partAssignments.map((r) => `${r.repair_part_id}:${r.problem_category_id}`),
      );

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
          message: 'Duplicate parts found in one or more final problems',
          location: 'final_problems.parts',
        });
      }

      const invalidParts = problems.flatMap((p) =>
        (p.parts || [])
          .filter((pt) => !allowedPartSet.has(`${pt.id}:${p.problem_category_id}`))
          .map((pt) => pt.id),
      );

      if (invalidParts.length > 0) {
        throw new BadRequestException({
          message: 'Some parts do not belong to the specified problem category',
          location: 'final_problems.parts',
          invalid_part_ids: [...new Set(invalidParts)],
        });
      }
    }

    // Insert parts
    const partRowsToInsert = problems.flatMap((p) =>
      (p.parts || []).map((pt) => ({
        repair_order_id: orderId,
        repair_order_initial_problem_id: null,
        repair_order_final_problem_id: problemCategoryToIdMap[p.problem_category_id],
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

    const current = await this.getProblemSnapshot(trx, orderId);

    await this.changeLogger.logIfChanged(trx, orderId, 'final_problems', old, current, admin.id);
  }

  private async getProblemSnapshot(
    trx: Knex.Transaction,
    orderId: string,
  ): Promise<ExistingFinalProblem[]> {
    const problems = await trx<{
      id: string;
      repair_order_id: string;
      problem_category_id: string;
      price: string | number;
      estimated_minutes: number;
    }>('repair_order_final_problems')
      .where({ repair_order_id: orderId })
      .select('id', 'problem_category_id', 'price', 'estimated_minutes')
      .orderBy('created_at', 'asc');

    if (!problems.length) return [];

    const parts = await trx<{
      repair_order_id: string;
      repair_order_final_problem_id: string;
      repair_part_id: string;
      quantity: number;
      part_price: string | number;
    }>('repair_order_parts')
      .where({ repair_order_id: orderId })
      .whereIn(
        'repair_order_final_problem_id',
        problems.map((problem) => problem.id),
      )
      .select('repair_order_final_problem_id', 'repair_part_id', 'quantity', 'part_price')
      .orderBy('created_at', 'asc');

    const partsByProblemId = new Map<
      string,
      Array<{ repair_part_id: string; quantity: number; part_price: string }>
    >();

    for (const part of parts) {
      const key = String(part.repair_order_final_problem_id);
      const current = partsByProblemId.get(key) ?? [];
      current.push({
        repair_part_id: String(part.repair_part_id),
        quantity: Number(part.quantity),
        part_price: String(part.part_price),
      });
      partsByProblemId.set(key, current);
    }

    return problems.map((problem) => ({
      problem_category_id: String(problem.problem_category_id),
      price: String(problem.price),
      estimated_minutes: Number(problem.estimated_minutes),
      parts: partsByProblemId.get(String(problem.id)) ?? [],
    }));
  }
}
