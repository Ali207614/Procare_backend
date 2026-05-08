/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 *
 * Converts the standard unique constraints on repair_order_statuses
 * into partial unique indexes that only apply to rows with status = 'Open'.
 * This allows "Deleted" statuses to coexist with new "Open" ones that share the same name.
 */
exports.up = async function (knex) {
  const table = 'repair_order_statuses';
  const constraints = [
    { name: 'repair_order_statuses_name_uz_branch_id_unique', cols: ['name_uz', 'branch_id'] },
    { name: 'repair_order_statuses_name_ru_branch_id_unique', cols: ['name_ru', 'branch_id'] },
    { name: 'repair_order_statuses_name_en_branch_id_unique', cols: ['name_en', 'branch_id'] },
  ];

  for (const constraint of constraints) {
    // 1. Drop standard unique constraint if it exists
    const { rows: existingConstraints } = await knex.raw(`
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name = '${table}'
        AND constraint_name = '${constraint.name}'
        AND constraint_type = 'UNIQUE';
    `);

    if (existingConstraints.length > 0) {
      await knex.schema.alterTable(table, (t) => {
        t.dropUnique(constraint.cols, constraint.name);
      });
    }

    // 2. Drop standard index if it exists as an index (alternate Knex behavior)
    await knex.raw(`DROP INDEX IF EXISTS ${constraint.name}`);

    // 3. Create partial unique index scoped to status = 'Open'
    await knex.raw(`
      CREATE UNIQUE INDEX ${constraint.name}
      ON ${table} (${constraint.cols.join(', ')})
      WHERE (status = 'Open');
    `);
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 *
 * Reverts back to standard (non-partial) unique constraints.
 */
exports.down = async function (knex) {
  const table = 'repair_order_statuses';
  const constraints = [
    { name: 'repair_order_statuses_name_uz_branch_id_unique', cols: ['name_uz', 'branch_id'] },
    { name: 'repair_order_statuses_name_ru_branch_id_unique', cols: ['name_ru', 'branch_id'] },
    { name: 'repair_order_statuses_name_en_branch_id_unique', cols: ['name_en', 'branch_id'] },
  ];

  for (const constraint of constraints) {
    await knex.raw(`DROP INDEX IF EXISTS ${constraint.name}`);

    await knex.schema.alterTable(table, (t) => {
      t.unique(constraint.cols, constraint.name);
    });
  }
};
