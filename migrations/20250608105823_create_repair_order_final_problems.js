exports.up = async function (knex) {
    await knex.schema.createTable('repair_order_final_problems', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

        table.uuid('repair_order_id').notNullable().references('id').inTable('repair_orders').onDelete('CASCADE');

        table.uuid('problem_category_id').notNullable().references('id').inTable('problem_categories').onDelete('RESTRICT');

        table.decimal('price', 12, 2).notNullable();
        table.integer('estimated_minutes').notNullable();

        table.uuid('created_by').notNullable().references('id').inTable('admins').onDelete('RESTRICT');

        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('repair_order_final_problems');
};
