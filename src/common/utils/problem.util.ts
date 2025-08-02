import { BadRequestException } from '@nestjs/common';
import { Knex } from 'knex';
import { RepairOrderStatusPermission } from 'src/common/types/repair-order-status-permssion.interface';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { ProblemWithParts } from 'src/common/types/problem-with-parts';



export async function validateAndInsertProblems(
  trx: Knex.Transaction,
  problems: ProblemWithParts[],
  phoneCategoryId: string,
  admin: AdminPayload,
  statusId: string,
  branchId: string,
  orderId: string,
  allPermissions: RepairOrderStatusPermission[],
  permissionKey: (keyof RepairOrderStatusPermission)[],
  locationKey: string,
  tableName: string,
  checkPermissionsOrThrow: (
    roleIds: string[],
    branchId: string,
    statusId: string,
    requiredFields: (keyof RepairOrderStatusPermission)[],
    location: string,
    permissions: RepairOrderStatusPermission[],
  ) => Promise<void>,
): Promise<void> {
  if (!problems?.length) return;

  await checkPermissionsOrThrow(
    admin.roles,
    branchId,
    statusId,
    permissionKey,
    locationKey,
    allPermissions,
  );

  const row = await trx('phone_problem_mappings')
    .where({ phone_category_id: phoneCategoryId })
    .first<{ problem_category_id: string }>();

  const rootProblemId = row?.problem_category_id;
  if (!rootProblemId) {
    throw new BadRequestException({
      message: 'No root problem is configured for this phone category',
      location: locationKey,
    });
  }

  const rawResult: Array<{ id: string }> = await trx
    .withRecursive('descendants', (qb) => {
      void qb
        .select('id')
        .from('problem_categories')
        .where('id', rootProblemId)
        .unionAll(function () {
          void this.select('c.id')
            .from('problem_categories as c')
            .join('descendants as d', 'c.parent_id', 'd.id')
            .where({ 'c.is_active': true, 'c.status': 'Open' });
        });
    })
    .select('id')
    .from('descendants');

  const allowedProblemIds = rawResult.map((r) => r.id);
  const submittedProblemIds = problems.map((p) => p.problem_category_id);
  const invalidProblemIds = submittedProblemIds.filter((id) => !allowedProblemIds.includes(id));

  if (invalidProblemIds.length) {
    throw new BadRequestException({
      message: 'Some problems are not allowed for this phone category',
      location: locationKey,
      invalid_problem_ids: invalidProblemIds,
    });
  }

  const now = new Date();

  // 🛠️ Insert problems
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

  // 🔍 Gather all part IDs
  const allPartIds = problems.flatMap((p) => p.parts?.map((pt) => pt.id) || []);
  const uniquePartIds = [...new Set(allPartIds)];

  // 🔐 Validate parts in DB
  const partRows = await trx('repair_parts')
    .whereIn('id', uniquePartIds)
    .select('id', 'problem_category_id');

  const partMap = Object.fromEntries(partRows.map((r) => [r.id, r.problem_category_id]));

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
      if (partMap[part.id] !== problem.problem_category_id) {
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

  // 🛠️ Insert repair_order_parts
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
