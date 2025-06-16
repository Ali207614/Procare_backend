exports.up = async function (knex) {
    await knex.schema.createTable('repair_order_deliveries', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

        table.uuid('repair_order_id').notNullable().references('id').inTable('repair_orders').onDelete('CASCADE');

        table.decimal('lat', 10, 7).notNullable();
        table.decimal('long', 10, 7).notNullable();
        table.string('description').notNullable();


        table.uuid('created_by').notNullable().references('id').inTable('admins').onDelete('RESTRICT');

        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('repair_order_deliveries');
};
