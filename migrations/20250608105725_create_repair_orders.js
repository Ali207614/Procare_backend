exports.up = async function (knex) {
    await knex.schema.createTable('repair_orders', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

        table.uuid('user_id').notNullable();
        table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');

        table.uuid('branch_id').notNullable();
        table.foreign('branch_id').references('id').inTable('branches').onDelete('CASCADE');

        table.decimal('total', 12, 2).notNullable().defaultTo(0);

        table.uuid('phone_category_id').notNullable();
        table.foreign('phone_category_id').references('id').inTable('phone_categories').onDelete('RESTRICT');

        table.uuid('status_id').notNullable();
        table.foreign('status_id').references('id').inTable('repair_order_statuses').onDelete('RESTRICT');

        table.enu('delivery_method', ['Self', 'Delivery']).notNullable();
        table.enu('pickup_method', ['Self', 'Pickup']).notNullable();

        table.integer('sort').defaultTo(1).notNullable();

        table.uuid('created_by').notNullable();
        table.foreign('created_by').references('id').inTable('admins').onDelete('RESTRICT');

        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('repair_orders');
};
