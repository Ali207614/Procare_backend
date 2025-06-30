import { BadRequestException } from '@nestjs/common';
import { Knex } from 'knex';

export async function validateAndInsertProblems(
  trx: Knex.Transaction,
  problems: { problem_category_id: string; price: number; estimated_minutes: number }[],
  phoneCategoryId: string,
  adminId: string,
  statusId: string,
  orderId: string,
  permissionKey: string,
  locationKey: string,
  tableName: string,
  validatePermission: (
    adminId: string,
    statusId: string,
    permission: string,
    location: string,
  ) => Promise<void>,
) {
  if (!problems?.length) return;

  await validatePermission(adminId, statusId, permissionKey, locationKey);

  const [rootProblemId] = await trx('phone_problem_mappings')
    .where({ phone_category_id: phoneCategoryId })
    .pluck('problem_category_id');

  if (!rootProblemId) {
    throw new BadRequestException({
      message: 'No root problem is configured for this phone category',
      location: locationKey,
    });
  }

  const rawResult = await trx
    .withRecursive('descendants', (qb) => {
      qb.select('id')
        .from('problem_categories')
        .where('id', rootProblemId)
        .unionAll(function () {
          this.select('c.id')
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
    created_by: adminId,
    created_at: now,
    updated_at: now,
  }));

  await trx(tableName).insert(rows);
}
