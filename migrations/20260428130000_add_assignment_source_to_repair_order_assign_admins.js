/**
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.up = async function (knex) {
  const hasAssignmentSource = await knex.schema.hasColumn(
    'repair_order_assign_admins',
    'assignment_source',
  );

  if (!hasAssignmentSource) {
    await knex.schema.alterTable('repair_order_assign_admins', (table) => {
      table.string('assignment_source').notNullable().defaultTo('manual');
    });
  }

  await knex.raw(`
    ALTER TABLE repair_order_assign_admins
    DROP CONSTRAINT IF EXISTS repair_order_assign_admins_assignment_source_check;

    ALTER TABLE repair_order_assign_admins
    ADD CONSTRAINT repair_order_assign_admins_assignment_source_check
    CHECK (assignment_source IN ('manual', 'telephony_auto', 'telephony_answered'));
  `);
};

/**
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.down = async function (knex) {
  await knex.raw(`
    ALTER TABLE repair_order_assign_admins
    DROP CONSTRAINT IF EXISTS repair_order_assign_admins_assignment_source_check;
  `);

  const hasAssignmentSource = await knex.schema.hasColumn(
    'repair_order_assign_admins',
    'assignment_source',
  );

  if (hasAssignmentSource) {
    await knex.schema.alterTable('repair_order_assign_admins', (table) => {
      table.dropColumn('assignment_source');
    });
  }
};
