exports.up = async function (knex) {
  await knex.raw(`CREATE SEQUENCE IF NOT EXISTS repair_order_number_seq START 1000;`);

  await knex.schema.createTable('repair_orders', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    table
      .bigInteger('number_id')
      .notNullable()
      .unique()
      .defaultTo(knex.raw(`nextval('repair_order_number_seq')`));

    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.uuid('branch_id').notNullable().references('id').inTable('branches').onDelete('CASCADE');

    table.decimal('total', 12, 2).notNullable().defaultTo(0);
    table.string('imei', 50).nullable();

    table
      .uuid('phone_category_id')
      .notNullable()
      .references('id')
      .inTable('phone_categories')
      .onDelete('RESTRICT');
    table
      .uuid('status_id')
      .notNullable()
      .references('id')
      .inTable('repair_order_statuses')
      .onDelete('RESTRICT');

    table.enu('delivery_method', ['Self', 'Delivery']).notNullable();
    table.enu('pickup_method', ['Self', 'Pickup']).notNullable();

    table.integer('sort').defaultTo(1).notNullable();
    table.enu('priority', ['Low', 'Medium', 'High', 'Highest']).notNullable().defaultTo('Medium');
    table.integer('priority_level').notNullable().defaultTo(2);

    table.uuid('created_by').notNullable().references('id').inTable('admins').onDelete('RESTRICT');
    table.enu('status', ['Open', 'Deleted','Closed','Cancelled']).defaultTo('Open');
    table.string("phone_number").notNullable();
    table.string("name")

    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('repair_orders');
  await knex.raw(`DROP SEQUENCE IF EXISTS repair_order_number_seq`);
};
