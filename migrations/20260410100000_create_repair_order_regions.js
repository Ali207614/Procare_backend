/**
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.up = async function (knex) {
  await knex.schema.createTable('repair_order_regions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('title', 150).notNullable();
    table.text('description').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(`
    CREATE UNIQUE INDEX repair_order_regions_title_unique_idx
    ON repair_order_regions (LOWER(title));
  `);

  await knex.schema.alterTable('repair_orders', (table) => {
    table
      .uuid('region_id')
      .nullable()
      .references('id')
      .inTable('repair_order_regions')
      .onDelete('RESTRICT')
      .index();
  });
};

/**
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.down = async function (knex) {
  await knex.schema.alterTable('repair_orders', (table) => {
    table.dropColumn('region_id');
  });

  await knex.raw('DROP INDEX IF EXISTS repair_order_regions_title_unique_idx');
  await knex.schema.dropTableIfExists('repair_order_regions');
};
