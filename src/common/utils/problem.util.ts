import { BadRequestException } from '@nestjs/common';
import { Knex } from 'knex';
import { RepairOrderStatusPermission } from 'src/common/types/repair-order-status-permssion.interface';
import { AdminPayload } from 'src/common/types/admin-payload.interface';

export async function validateAndInsertProblems(
  trx: Knex.Transaction,
  problems: { problem_category_id: string; price: number; estimated_minutes: number }[],
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
  const rows = problems.map((p) => ({
    repair_order_id: orderId,
    problem_category_id: p.problem_category_id,
    price: p.price,
    estimated_minutes: p.estimated_minutes,
    created_by: admin.id,
    created_at: now,
    updated_at: now,
  }));

  await trx(tableName).insert(rows);
}
