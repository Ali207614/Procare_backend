exports.up = async function (knex) {
    await knex.schema.createTable('rental_phone_devices', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

        table.string('code').notNullable().unique();
        table.string('name').notNullable();

        table.boolean('is_free').notNullable().defaultTo(false);
        table.decimal('price', 12, 2).nullable();
        table.enu('currency', ['UZS', 'USD', 'EUR']).nullable();

        table.boolean('is_available').notNullable().defaultTo(true);
        table.boolean('is_synced_from_sap').notNullable().defaultTo(false);
        table.text('notes').nullable();

        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('rental_phone_devices');
};
