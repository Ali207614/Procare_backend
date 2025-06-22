exports.up = async function (knex) {
    await knex.schema.createTable('repair_order_rental_phones', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

        table.uuid('repair_order_id').notNullable()
            .references('id').inTable('repair_orders').onDelete('CASCADE');

        table.uuid('rental_phone_device_id').notNullable()
            .references('id').inTable('rental_phone_devices').onDelete('RESTRICT');

        table.string('sap_order_id').nullable();

        table.boolean('is_free').nullable();
        table.decimal('price', 12, 2).nullable();
        table.enu('currency', ['UZS', 'USD', 'EUR']).nullable();

        table.enu('status', ['Active', 'Returned', 'Cancelled'])
            .notNullable().defaultTo('Active');

        table.date('rented_at').notNullable().defaultTo(knex.fn.now());
        table.date('returned_at').nullable();

        table.text('notes').nullable();

        table.uuid('created_by').notNullable()
            .references('id').inTable('admins').onDelete('SET NULL');

        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('repair_order_rental_phones');
};
