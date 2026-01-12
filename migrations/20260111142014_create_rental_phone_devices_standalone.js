exports.up = async function (knex) {
  await knex.schema.createTable('rental_phone_devices', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('code').notNullable().unique();
    table.string('name').notNullable();
    table.string('brand').nullable();
    table.string('model').nullable();
    table.string('imei').nullable();
    table.string('serial_number').nullable();
    table.string('color').nullable();
    table.string('storage_capacity').nullable();
    table.boolean('is_free').notNullable().defaultTo(false);
    table.decimal('daily_rent_price', 12, 2).notNullable().defaultTo(0);
    table.decimal('deposit_amount', 12, 2).defaultTo(0);
    table.enu('currency', ['UZS', 'USD', 'EUR']).defaultTo('UZS');
    table.boolean('is_available').notNullable().defaultTo(true);
    table.enu('status', ['Available', 'Rented', 'Maintenance', 'Lost', 'Damaged', 'Retired']).defaultTo('Available');
    table.enu('condition', ['Excellent', 'Good', 'Fair', 'Poor']).defaultTo('Good');
    table.integer('quantity').notNullable().defaultTo(1);
    table.integer('quantity_available').notNullable().defaultTo(1);
    table.text('notes').nullable();
    table.text('specifications').nullable();
    table.integer('sort').notNullable().defaultTo(1);
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);

    table.index(['code']);
    table.index(['brand']);
    table.index(['status']);
    table.index(['is_available']);
    table.index(['sort']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('rental_phone_devices');
};