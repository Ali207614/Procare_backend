exports.up = async function (knex) {
  const tableName = 'repair-order-status-transitions';
  const hasRoleId = await knex.schema.hasColumn(tableName, 'role_id');

  if (!hasRoleId) {
    await knex.schema.alterTable(tableName, (table) => {
      table.uuid('role_id').nullable().references('id').inTable('roles').onDelete('CASCADE');
    });
  }

  await knex.raw(`
    DO $$
    DECLARE existing_constraint text;
    BEGIN
      SELECT constraint_name
        INTO existing_constraint
      FROM information_schema.table_constraints
      WHERE table_name = 'repair-order-status-transitions'
        AND constraint_type = 'UNIQUE'
        AND constraint_name LIKE 'repair-order-status-transitions_from_status_id_to_status_id%'
      LIMIT 1;

      IF existing_constraint IS NOT NULL THEN
        EXECUTE format(
          'ALTER TABLE "repair-order-status-transitions" DROP CONSTRAINT %I',
          existing_constraint
        );
      END IF;
    END $$;
  `);

  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS repair_order_status_transitions_legacy_unique_idx
    ON "repair-order-status-transitions" (from_status_id, to_status_id)
    WHERE role_id IS NULL
  `);

  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS repair_order_status_transitions_role_unique_idx
    ON "repair-order-status-transitions" (role_id, from_status_id, to_status_id)
    WHERE role_id IS NOT NULL
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS repair_order_status_transitions_role_from_idx
    ON "repair-order-status-transitions" (role_id, from_status_id)
  `);
};

exports.down = async function (knex) {
  const tableName = 'repair-order-status-transitions';

  await knex.raw('DROP INDEX IF EXISTS repair_order_status_transitions_role_from_idx');
  await knex.raw('DROP INDEX IF EXISTS repair_order_status_transitions_role_unique_idx');
  await knex.raw('DROP INDEX IF EXISTS repair_order_status_transitions_legacy_unique_idx');

  const hasRoleId = await knex.schema.hasColumn(tableName, 'role_id');
  if (hasRoleId) {
    await knex(tableName).whereNotNull('role_id').del();

    await knex.schema.alterTable(tableName, (table) => {
      table.dropColumn('role_id');
    });
  }

  await knex.raw(`
    ALTER TABLE "repair-order-status-transitions"
    ADD CONSTRAINT "repair-order-status-transitions_from_status_id_to_status_id_unique"
    UNIQUE (from_status_id, to_status_id)
  `);
};
