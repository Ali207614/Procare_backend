const ROLE_TYPES = ['SuperAdmin', 'Operator', 'Specialist', 'Master', 'Courier'];
const ROLE_TYPES_SQL = ROLE_TYPES.map((type) => `'${type.replace(/'/g, "''")}'`).join(', ');

exports.up = async function (knex) {
  const hasType = await knex.schema.hasColumn('roles', 'type');

  if (!hasType) {
    await knex.schema.alterTable('roles', (table) => {
      table.string('type').nullable();
    });
  }

  await knex.raw(`
    ALTER TABLE roles
    DROP CONSTRAINT IF EXISTS roles_type_check;
  `);

  await knex.raw(`
    ALTER TABLE roles
    ADD CONSTRAINT roles_type_check
    CHECK ("type" IS NULL OR "type" IN (${ROLE_TYPES_SQL}));
  `);

  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS roles_open_type_unique
    ON roles ("type")
    WHERE status = 'Open' AND "type" IS NOT NULL;
  `);

  const hasAssignmentSource = await knex.schema.hasColumn(
    'repair_order_assign_admins',
    'assignment_source',
  );

  if (hasAssignmentSource) {
    await knex.raw(`
      ALTER TABLE repair_order_assign_admins
      DROP CONSTRAINT IF EXISTS repair_order_assign_admins_assignment_source_check;

      ALTER TABLE repair_order_assign_admins
      ADD CONSTRAINT repair_order_assign_admins_assignment_source_check
      CHECK (assignment_source IN ('manual', 'telephony_auto', 'telephony_answered', 'role_update_auto'));
    `);
  }
};

exports.down = async function (knex) {
  const hasAssignmentSource = await knex.schema.hasColumn(
    'repair_order_assign_admins',
    'assignment_source',
  );

  if (hasAssignmentSource) {
    await knex.raw(`
      ALTER TABLE repair_order_assign_admins
      DROP CONSTRAINT IF EXISTS repair_order_assign_admins_assignment_source_check;

      ALTER TABLE repair_order_assign_admins
      ADD CONSTRAINT repair_order_assign_admins_assignment_source_check
      CHECK (assignment_source IN ('manual', 'telephony_auto', 'telephony_answered'));
    `);
  }

  await knex.raw('DROP INDEX IF EXISTS roles_open_type_unique;');
  await knex.raw('ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_type_check;');

  const hasType = await knex.schema.hasColumn('roles', 'type');
  if (hasType) {
    await knex.schema.alterTable('roles', (table) => {
      table.dropColumn('type');
    });
  }
};
