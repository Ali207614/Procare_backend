exports.up = async function (knex) {
    await knex.schema.createTable('repair_order_assign_admins', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

        table.uuid('repair_order_id').notNullable().references('id').inTable('repair_orders').onDelete('CASCADE');

        table.uuid('admin_id').notNullable().references('id').inTable('admins').onDelete('RESTRICT');

        table.timestamp('created_at').defaultTo(knex.fn.now());
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('repair_order_assign_admins');
};
