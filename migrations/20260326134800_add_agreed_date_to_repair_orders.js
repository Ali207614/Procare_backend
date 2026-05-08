/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 *
 * Adds `agreed_date` (nullable string) to the `repair_orders` table.
 * Safe to run even if the column was already added manually — uses
 * `ADD COLUMN IF NOT EXISTS` so it is fully idempotent.
 */
exports.up = async function (knex) {
  const hasColumn = await knex.schema.hasColumn('repair_orders', 'agreed_date');
  if (!hasColumn) {
    await knex.schema.alterTable('repair_orders', (table) => {
      table.string('agreed_date').nullable();
    });
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  const hasColumn = await knex.schema.hasColumn('repair_orders', 'agreed_date');
  if (hasColumn) {
    await knex.schema.alterTable('repair_orders', (table) => {
      table.dropColumn('agreed_date');
    });
  }
};
