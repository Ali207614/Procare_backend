exports.up = async function (knex) {
  await knex.schema.createTable('repair_order_payments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    table
      .uuid('repair_order_id')
      .notNullable()
      .references('id')
      .inTable('repair_orders')
      .onDelete('CASCADE');

    table.decimal('amount', 12, 2).notNullable();
    table.enu('type', ['cash', 'transfer', 'credit card']).notNullable();

    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('repair_order_payments');
};

