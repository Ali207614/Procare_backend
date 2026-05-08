import { BadRequestException } from '@nestjs/common';
import { Knex } from 'knex';
import { RepairOrderStatusPermission } from 'src/common/types/repair-order-status-permssion.interface';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { ProblemWithParts } from 'src/common/types/problem-with-parts';

export async function validateAndInsertProblems(
  trx: Knex.Transaction,
  problems: ProblemWithParts[],
  phoneCategoryId: string | undefined,
  admin: AdminPayload,
  statusId: string,
  branchId: string,
  orderId: string,
  allPermissions: RepairOrderStatusPermission[],
  permissionKey: (keyof RepairOrderStatusPermission)[],
  locationKey: string,
  tableName: string,
  checkPermissionsOrThrow: (
    roleIds: { name: string; id: string }[],
    branchId: string,
    statusId: string,
    requiredFields: (keyof RepairOrderStatusPermission)[],
    location: string,
    permissions: RepairOrderStatusPermission[],
  ) => Promise<void>,
): Promise<void> {
  if (!problems?.length) return;

  if (!phoneCategoryId) {
    throw new BadRequestException({
      message: 'Problems cannot be added without a phone category',
      location: locationKey,
    });
  }

  // 🔐 permission check
  await checkPermissionsOrThrow(
    admin.roles,
    branchId,
    statusId,
    permissionKey,
    locationKey,
    allPermissions,
  );

  const submittedProblemIds: string[] = problems.map(
    (p: ProblemWithParts) => p.problem_category_id,
  );

  const existingCategories = await trx('problem_categories')
    .whereIn('id', submittedProblemIds)
    .andWhere({ status: 'Open', is_active: true })
    .select<{ id: string }[]>('id');

  if (existingCategories.length !== submittedProblemIds.length) {
    const existingIds = existingCategories.map((c) => c.id);
    const missing = submittedProblemIds.filter((id) => !existingIds.includes(id));
    throw new BadRequestException({
      message: 'Some problem categories are not found or inactive',
      location: locationKey,
      missing_ids: missing,
    });
  }

  const pathRows = await trx
    .withRecursive('problem_path', (qb) => {
      void qb
        .select('id', 'parent_id', 'id as start_id')
        .from('problem_categories')
        .whereIn('id', submittedProblemIds)
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

  const invalidProblemIds: string[] = submittedProblemIds.filter(
    (id: string) => !allowedStartIds.has(id),
  );

  if (invalidProblemIds.length) {
    throw new BadRequestException({
      message: 'Some problems are not allowed for this phone category',
      location: locationKey,
      invalid_problem_ids: invalidProblemIds,
    });
  }

  const now = new Date();

  const problemInsertData = problems.map((p) => ({
    repair_order_id: orderId,
    problem_category_id: p.problem_category_id,
    price: p.price,
    estimated_minutes: p.estimated_minutes,
    created_by: admin.id,
    created_at: now,
    updated_at: now,
  }));

  const insertedProblems = await trx
    .insert(problemInsertData)
    .into(tableName)
    .returning(['id', 'problem_category_id']);

  const problemCategoryToIdMap = Object.fromEntries(
    insertedProblems.map((row) => [row.problem_category_id, row.id]),
  );

  const allPartIds: string[] = problems.flatMap(
    (p: ProblemWithParts) => p.parts?.map((pt) => pt.id) || [],
  );
  const uniquePartIds: string[] = [...new Set(allPartIds)];

  if (uniquePartIds.length > 0) {
    const partAssignments = await trx('repair_part_assignments')
      .whereIn('repair_part_id', uniquePartIds)
      .select('repair_part_id', 'problem_category_id');

    const allowedPartSet = new Set(
      partAssignments.map((r) => `${r.repair_part_id}:${r.problem_category_id}`),
    );

    const duplicates = allPartIds.filter((id, index, self) => self.indexOf(id) !== index);
    if (duplicates.length) {
      throw new BadRequestException({
        message: 'Some parts are duplicated',
        location: locationKey,
        duplicated_part_ids: [...new Set(duplicates)],
      });
    }

    const invalidParts: string[] = [];
    for (const problem of problems) {
      const partList = problem.parts || [];
      for (const part of partList) {
        if (!allowedPartSet.has(`${part.id}:${problem.problem_category_id}`)) {
          invalidParts.push(part.id);
        }
      }
    }

    if (invalidParts.length) {
      throw new BadRequestException({
        message: 'Some parts do not belong to the problem category',
        location: locationKey,
        invalid_part_ids: [...new Set(invalidParts)],
      });
    }

    const repairOrderPartsData = problems.flatMap((problem) => {
      const repair_order_problem_id = problemCategoryToIdMap[problem.problem_category_id];
      return (problem.parts || []).map((part) => ({
        repair_order_id: orderId,
        repair_order_initial_problem_id:
          tableName === 'repair_order_initial_problems' ? repair_order_problem_id : null,
        repair_order_final_problem_id:
          tableName === 'repair_order_final_problems' ? repair_order_problem_id : null,
        repair_part_id: part.id,
        part_price: part.part_price,
        quantity: part.quantity,
        created_by: admin.id,
        created_at: now,
        updated_at: now,
      }));
    });

    if (repairOrderPartsData.length > 0) {
      await trx('repair_order_parts').insert(repairOrderPartsData);
    }
  }
}
