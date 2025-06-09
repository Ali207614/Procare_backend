exports.up = async function (knex) {
    await knex.schema.createTable('repair_order_comments', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

        table.uuid('repair_order_id').notNullable();
        table.foreign('repair_order_id').references('id').inTable('repair_orders').onDelete('CASCADE');

        table.string('text').notNullable();
        table.enu('status', ['Open', 'Deleted']).defaultTo('Open');

        table.uuid('created_by').notNullable();
        table.foreign('created_by').references('id').inTable('admins').onDelete('RESTRICT');

        table.uuid('status_by').notNullable();
        table.foreign('status_by').references('id').inTable('repair_order_statuses').onDelete('RESTRICT');

        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('repair_order_comments');
};
