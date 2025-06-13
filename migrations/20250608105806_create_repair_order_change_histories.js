exports.up = async function (knex) {
    await knex.schema.createTable('repair_order_change_histories', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

        table.uuid('repair_order_id').notNullable().references('id').inTable('repair_orders').onDelete('CASCADE');

        table.string('field').notNullable();
        table.jsonb('old_value');
        table.jsonb('new_value');

        table.uuid('created_by').notNullable().references('id').inTable('admins').onDelete('RESTRICT');

        table.timestamp('created_at').defaultTo(knex.fn.now());
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('repair_order_change_histories');
};
