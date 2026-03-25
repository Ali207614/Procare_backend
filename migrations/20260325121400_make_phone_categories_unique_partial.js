/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 *
 * Converts the standard unique constraint on (name_uz, parent_id)
 * into a partial unique index that only applies to rows with status = 'Open'.
 * This allows "Deleted" categories to coexist with new "Open" ones that share the same name.
 *
 * Handles both cases:
 *  - Production: standard constraint exists → drop it, create partial index
 *  - Already-modified DB: partial index already exists → no-op
 */
exports.up = async function (knex) {
  // Check if the standard constraint still exists (production scenario)
  const { rows: constraints } = await knex.raw(`
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'phone_categories'
      AND constraint_name = 'phone_categories_name_uz_parent_id_unique'
      AND constraint_type = 'UNIQUE';
  `);

  if (constraints.length > 0) {
    // Standard constraint exists — drop it
    await knex.schema.alterTable('phone_categories', (table) => {
      table.dropUnique(['name_uz', 'parent_id'], 'phone_categories_name_uz_parent_id_unique');
    });
  }

  // Check if the partial index already exists
  const { rows: indexes } = await knex.raw(`
    SELECT 1
    FROM pg_indexes
    WHERE tablename = 'phone_categories'
      AND indexname = 'phone_categories_name_uz_parent_id_unique';
  `);

  if (indexes.length === 0) {
    // Create partial unique index scoped to status = 'Open'
    await knex.raw(`
      CREATE UNIQUE INDEX phone_categories_name_uz_parent_id_unique
      ON phone_categories (name_uz, parent_id)
      WHERE (status = 'Open');
    `);
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 *
 * Reverts back to the standard (non-partial) unique constraint.
 */
exports.down = async function (knex) {
  await knex.raw(`DROP INDEX IF EXISTS phone_categories_name_uz_parent_id_unique;`);

  await knex.schema.alterTable('phone_categories', (table) => {
    table.unique(['name_uz', 'parent_id'], 'phone_categories_name_uz_parent_id_unique');
  });
};
