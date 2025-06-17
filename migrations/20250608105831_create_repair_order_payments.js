exports.up = async function (knex) {
    await knex.schema.createTable('repair_order_payments', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

        table.uuid('repair_order_id').notNullable().references('id').inTable('repair_orders').onDelete('CASCADE');

        table.decimal('amount', 12, 2).notNullable();
        table.enu('currency', ['UZS', 'USD', 'EUR']).notNullable();

        table.string('payment_method').notNullable(); // manual, payme, click, uzum
        table.string('payment_status').defaultTo('pending');

        table.string('payme_transaction_id');
        table.timestamp('payme_time');

        // ▶️ Click
        table.string('click_transaction_id');
        table.timestamp('click_time');

        // ▶️ Uzum
        table.string('uzum_transaction_id');
        table.timestamp('uzum_time');

        // ▶️ Common
        table.timestamp('canceled_at');
        table.timestamp('paid_at');

        table.uuid('created_by').notNullable().references('id').inTable('admins').onDelete('RESTRICT');

        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('repair_order_payments');
};
