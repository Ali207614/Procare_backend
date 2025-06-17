exports.up = async function (knex) {
    await knex.schema.createTable('repair_orders', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

        table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');

        table.uuid('branch_id').notNullable().references('id').inTable('branches').onDelete('CASCADE');

        table.decimal('total', 12, 2).notNullable().defaultTo(0);
        table.string('imei', 50).nullable();

        table.uuid('phone_category_id').notNullable().references('id').inTable('phone_categories').onDelete('RESTRICT');

        table.uuid('status_id').notNullable().references('id').inTable('repair_order_statuses').onDelete('RESTRICT');

        table.enu('delivery_method', ['Self', 'Delivery']).notNullable();
        table.enu('pickup_method', ['Self', 'Pickup']).notNullable();

        table.integer('sort').defaultTo(1).notNullable();

        table.enu('priority', ['Low', 'Medium', 'High', 'Highest']).notNullable().defaultTo('Medium');
        table.integer('priority_level').notNullable().defaultTo(2);

        table.uuid('created_by').notNullable().references('id').inTable('admins').onDelete('RESTRICT');

        table.enu('status', ['Open', 'Deleted']).defaultTo('Open');

        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('repair_orders');
};
