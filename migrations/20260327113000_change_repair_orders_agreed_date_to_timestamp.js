/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  const hasColumn = await knex.schema.hasColumn('repair_orders', 'agreed_date');
  if (!hasColumn) {
    return;
  }

  await knex.raw(`
    ALTER TABLE repair_orders
    ALTER COLUMN agreed_date TYPE timestamp
    USING NULLIF(BTRIM(agreed_date), '')::timestamp
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  const hasColumn = await knex.schema.hasColumn('repair_orders', 'agreed_date');
  if (!hasColumn) {
    return;
  }

  await knex.raw(`
    ALTER TABLE repair_orders
    ALTER COLUMN agreed_date TYPE varchar(255)
    USING CASE
      WHEN agreed_date IS NULL THEN NULL
      ELSE TO_CHAR(agreed_date, 'YYYY-MM-DD HH24:MI')
    END
  `);
};
