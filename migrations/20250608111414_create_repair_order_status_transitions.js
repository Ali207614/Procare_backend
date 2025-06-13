exports.up = async function (knex) {
    await knex.schema.createTable('repair_order_status_transitions', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

        table.uuid('from_status_id').notNullable().references('id').inTable('repair_order_statuses').onDelete('CASCADE');

        table.uuid('to_status_id').notNullable().references('id').inTable('repair_order_statuses').onDelete('CASCADE');

        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());

        // unik transitionlarni oldini olish uchun:
        table.unique(['from_status_id', 'to_status_id']);
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('repair_order_status_transitions');
};
