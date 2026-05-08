/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // PostgreSQL handles CHECK constraints for enums created via table.enu()
  // We need to drop the old constraint and add a new one with 'Organic' included.
  await knex.raw(`
    ALTER TABLE repair_orders 
    DROP CONSTRAINT IF EXISTS repair_orders_source_check;
    
    ALTER TABLE repair_orders 
    ADD CONSTRAINT repair_orders_source_check 
    CHECK (source = ANY (ARRAY['Telegram'::text, 'Meta'::text, 'Qolda'::text, 'Boshqa'::text, 'Kiruvchi qongiroq'::text, 'Chiquvchi qongiroq'::text, 'Organic'::text]));
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  // Before reverting the constraint, we should handle any records that might be using 'Organic'
  await knex('repair_orders')
    .where('source', 'Organic')
    .update({ source: 'Boshqa' });

  await knex.raw(`
    ALTER TABLE repair_orders 
    DROP CONSTRAINT IF EXISTS repair_orders_source_check;
    
    ALTER TABLE repair_orders 
    ADD CONSTRAINT repair_orders_source_check 
    CHECK (source = ANY (ARRAY['Telegram'::text, 'Meta'::text, 'Qolda'::text, 'Boshqa'::text, 'Kiruvchi qongiroq'::text, 'Chiquvchi qongiroq'::text]));
  `);
};
