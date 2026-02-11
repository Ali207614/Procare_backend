exports.up = async function (knex) {
  await knex.schema.createTable('rental_phone_devices', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    table.string('name').notNullable();
    table.string('brand').nullable();
    table.string('model').nullable();
    table.string('imei').nullable().unique();
    table.string('color').nullable();
    table.string('storage_capacity').nullable();
    table.string('battery_capacity').nullable();

    table.boolean('is_free').notNullable().defaultTo(false);
    table.decimal('daily_rent_price', 12, 2).notNullable().defaultTo(0);
    table.decimal('deposit_amount', 12, 2).notNullable().defaultTo(0);
    table.enu('currency', ['UZS', 'USD', 'EUR']).notNullable().defaultTo('UZS');

    table.boolean('is_available').notNullable().defaultTo(true);
    table.enu('status', ['Available', 'Rented', 'Maintenance', 'Lost', 'Damaged', 'Retired']).notNullable().defaultTo('Available');
    table.enu('condition', ['Excellent', 'Good', 'Fair', 'Poor']).notNullable().defaultTo('Good');

    table.integer('quantity').notNullable().defaultTo(1);
    table.integer('quantity_available').notNullable().defaultTo(1);

    table.text('notes').nullable();
    table.text('specifications').nullable();
    table.integer('sort').defaultTo(1).notNullable();
    

    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('rental_phone_devices');
};
