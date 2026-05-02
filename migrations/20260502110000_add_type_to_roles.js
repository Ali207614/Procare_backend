const ROLE_TYPES = ['SuperAdmin', 'Operator', 'Specialist', 'Master', 'Courier'];
const ROLE_TYPES_SQL = ROLE_TYPES.map((type) => `'${type.replace(/'/g, "''")}'`).join(', ');
const NORMALIZED_ROLE_TYPE_SQL = `
  CASE
    WHEN "type" IS NULL OR BTRIM("type") = '' THEN NULL
    WHEN LOWER(REGEXP_REPLACE(BTRIM("type"), '[[:space:]_]+', '', 'g')) = 'superadmin' THEN 'SuperAdmin'
    WHEN LOWER(REGEXP_REPLACE(BTRIM("type"), '[[:space:]_]+', '', 'g')) = 'operator' THEN 'Operator'
    WHEN LOWER(REGEXP_REPLACE(BTRIM("type"), '[[:space:]_]+', '', 'g')) IN ('specialist', 'spetsialist', 'spetialist') THEN 'Specialist'
    WHEN LOWER(REGEXP_REPLACE(BTRIM("type"), '[[:space:]_]+', '', 'g')) IN ('master', 'usta') THEN 'Master'
    WHEN LOWER(REGEXP_REPLACE(BTRIM("type"), '[[:space:]_]+', '', 'g')) = 'courier' THEN 'Courier'
    ELSE NULL
  END
`;
const NORMALIZED_ASSIGNMENT_SOURCE_SQL = `
  CASE
    WHEN assignment_source IS NULL OR BTRIM(assignment_source) = '' THEN 'manual'
    WHEN LOWER(REGEXP_REPLACE(BTRIM(assignment_source), '[^a-z]+', '_', 'g')) = 'manual' THEN 'manual'
    WHEN LOWER(REGEXP_REPLACE(BTRIM(assignment_source), '[^a-z]+', '_', 'g')) = 'telephony_auto' THEN 'telephony_auto'
    WHEN LOWER(REGEXP_REPLACE(BTRIM(assignment_source), '[^a-z]+', '_', 'g')) = 'telephony_answered' THEN 'telephony_answered'
    WHEN LOWER(REGEXP_REPLACE(BTRIM(assignment_source), '[^a-z]+', '_', 'g')) = 'role_update_auto' THEN 'role_update_auto'
    ELSE 'manual'
  END
`;
const LEGACY_ASSIGNMENT_SOURCE_SQL = `
  CASE
    WHEN assignment_source IS NULL OR BTRIM(assignment_source) = '' THEN 'manual'
    WHEN LOWER(REGEXP_REPLACE(BTRIM(assignment_source), '[^a-z]+', '_', 'g')) = 'manual' THEN 'manual'
    WHEN LOWER(REGEXP_REPLACE(BTRIM(assignment_source), '[^a-z]+', '_', 'g')) = 'telephony_auto' THEN 'telephony_auto'
    WHEN LOWER(REGEXP_REPLACE(BTRIM(assignment_source), '[^a-z]+', '_', 'g')) = 'telephony_answered' THEN 'telephony_answered'
    ELSE 'manual'
  END
`;

exports.up = async function (knex) {
  const hasType = await knex.schema.hasColumn('roles', 'type');

  if (!hasType) {
    await knex.schema.alterTable('roles', (table) => {
      table.string('type').nullable();
    });
  }

  await knex.raw(`
    UPDATE roles
    SET
      "type" = ${NORMALIZED_ROLE_TYPE_SQL},
      updated_at = NOW()
    WHERE "type" IS DISTINCT FROM ${NORMALIZED_ROLE_TYPE_SQL};
  `);

  await knex.raw(`
    WITH ranked_roles AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY "type"
          ORDER BY
            CASE WHEN is_protected THEN 0 ELSE 1 END,
            created_at ASC NULLS LAST,
            id ASC
        ) AS row_num
      FROM roles
      WHERE status = 'Open'
        AND "type" IS NOT NULL
    )
    UPDATE roles AS r
    SET
      "type" = NULL,
      updated_at = NOW()
    FROM ranked_roles
    WHERE r.id = ranked_roles.id
      AND ranked_roles.row_num > 1;
  `);

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
    DROP INDEX IF EXISTS roles_open_type_unique;
  `);

  await knex.raw(`
    CREATE UNIQUE INDEX roles_open_type_unique
    ON roles ("type")
    WHERE status = 'Open' AND "type" IS NOT NULL;
  `);

  const hasAssignmentSource = await knex.schema.hasColumn(
    'repair_order_assign_admins',
    'assignment_source',
  );

  if (hasAssignmentSource) {
    await knex.raw(`
      UPDATE repair_order_assign_admins
      SET
        assignment_source = ${NORMALIZED_ASSIGNMENT_SOURCE_SQL}
      WHERE assignment_source IS DISTINCT FROM ${NORMALIZED_ASSIGNMENT_SOURCE_SQL};
    `);

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
      UPDATE repair_order_assign_admins
      SET assignment_source = ${LEGACY_ASSIGNMENT_SOURCE_SQL}
      WHERE assignment_source IS DISTINCT FROM ${LEGACY_ASSIGNMENT_SOURCE_SQL};
    `);

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
