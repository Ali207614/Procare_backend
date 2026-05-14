/**
 * Adds the 'Agreed' type to repair_order_statuses and marks
 * the "Uchrashuv belgilandi" status as type = 'Agreed' in every branch.
 */
exports.up = async function (knex) {
  // 1. Extend the CHECK constraint to include 'Agreed'
  await knex.raw(`
    ALTER TABLE "repair_order_statuses"
      DROP CONSTRAINT IF EXISTS "repair_order_statuses_type_check";
    ALTER TABLE "repair_order_statuses"
      ADD CONSTRAINT "repair_order_statuses_type_check"
      CHECK (type IN ('Completed', 'Cancelled', 'Open', 'Invalid', 'Missed', 'Agreed'));
  `);

  // 2. Find all statuses named "Uchrashuv belgilandi" and set their type to 'Agreed'
  const updated = await knex('repair_order_statuses')
    .where({ name_uz: 'Uchrashuv belgilandi', status: 'Open' })
    .update({ type: 'Agreed', updated_at: new Date() });

  console.log(
    `[Migration] Marked ${updated} "Uchrashuv belgilandi" status(es) as type = 'Agreed'.`,
  );
};

exports.down = async function (knex) {
  // Revert the type back to null for any 'Agreed' statuses
  await knex('repair_order_statuses')
    .where({ type: 'Agreed' })
    .update({ type: null, updated_at: new Date() });

  // Restore the CHECK constraint without 'Agreed'
  await knex.raw(`
    ALTER TABLE "repair_order_statuses"
      DROP CONSTRAINT IF EXISTS "repair_order_statuses_type_check";
    ALTER TABLE "repair_order_statuses"
      ADD CONSTRAINT "repair_order_statuses_type_check"
      CHECK (type IN ('Completed', 'Cancelled', 'Open', 'Invalid', 'Missed'));
  `);
};
