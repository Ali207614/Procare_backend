exports.up = async function (knex) {
  await knex.raw(`
    ALTER TABLE "repair_order_statuses" DROP CONSTRAINT IF EXISTS "repair_order_statuses_type_check";
    ALTER TABLE "repair_order_statuses" ADD CONSTRAINT "repair_order_statuses_type_check" CHECK (type IN ('Completed', 'Cancelled', 'Open', 'Invalid'));
  `);
};

exports.down = async function (knex) {
  // We should be careful rolling back if there are rows with 'Invalid'
  // But standard practice is to allow the migration to revert schema
  await knex.raw(`
    ALTER TABLE "repair_order_statuses" DROP CONSTRAINT IF EXISTS "repair_order_statuses_type_check";
    ALTER TABLE "repair_order_statuses" ADD CONSTRAINT "repair_order_statuses_type_check" CHECK (type IN ('Completed', 'Cancelled', 'Open'));
  `);
};
