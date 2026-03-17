exports.up = async function (knex) {
  await knex.schema.createTable('repair_order_rental_phones', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    table
      .uuid('repair_order_id')
      .nullable()
      .references('id')
      .inTable('repair_orders')
      .onDelete('CASCADE');

    table
      .uuid('rental_phone_device_id')
      .nullable()
      .references('id')
      .inTable('rental_phone_devices')
      .onDelete('RESTRICT');

    table.string('external_order_id').nullable();

    table.boolean('is_free').nullable();
    table.decimal('price', 12, 2).nullable();
    table.enu('currency', ['UZS', 'USD', 'EUR']).nullable();
    table.string('marked_as_returned_by').nullable();
    table.string('marked_as_cancelled_by').nullable();

    table.enu('status', ['Pending', 'Active', 'Returned', 'Cancelled']).notNullable().defaultTo('Pending');

    table.date('rented_at').nullable().defaultTo(knex.fn.now());
    table.date('returned_at').nullable();

    table.text('notes').nullable();

    table.uuid('created_by').notNullable().references('id').inTable('admins').onDelete('SET NULL');

    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('repair_order_rental_phones');
};
