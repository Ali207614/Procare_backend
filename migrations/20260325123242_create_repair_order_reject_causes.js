/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.createTable('repair_order_reject_causes', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable();
    table.text('description').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable('repair_orders', (table) => {
    table.uuid('reject_cause_id').references('id').inTable('repair_order_reject_causes').onDelete('RESTRICT').nullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.alterTable('repair_orders', (table) => {
    table.dropColumn('reject_cause_id');
  });
  await knex.schema.dropTableIfExists('repair_order_reject_causes');
};


