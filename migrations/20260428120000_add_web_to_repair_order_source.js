/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.raw(`
    ALTER TABLE repair_orders
    DROP CONSTRAINT IF EXISTS repair_orders_source_check;

    ALTER TABLE repair_orders
    ADD CONSTRAINT repair_orders_source_check
    CHECK (source = ANY (ARRAY[
      'Telegram'::text,
      'Meta'::text,
      'Qolda'::text,
      'Boshqa'::text,
      'Kiruvchi qongiroq'::text,
      'Chiquvchi qongiroq'::text,
      'Organic'::text,
      'Sug''urta'::text,
      'Web'::text
    ]));
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex('repair_orders').where('source', 'Web').update({ source: 'Boshqa' });

  await knex.raw(`
    ALTER TABLE repair_orders
    DROP CONSTRAINT IF EXISTS repair_orders_source_check;

    ALTER TABLE repair_orders
    ADD CONSTRAINT repair_orders_source_check
    CHECK (source = ANY (ARRAY[
      'Telegram'::text,
      'Meta'::text,
      'Qolda'::text,
      'Boshqa'::text,
      'Kiruvchi qongiroq'::text,
      'Chiquvchi qongiroq'::text,
      'Organic'::text,
      'Sug''urta'::text
    ]));
  `);
};
