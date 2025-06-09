exports.up = async function (knex) {
    await knex.schema.createTable('repair_order_status_permissions', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

        table.uuid('branch_id').notNullable();
        table.foreign('branch_id').references('id').inTable('branches').onDelete('CASCADE');

        table.uuid('status_id').notNullable();
        table.foreign('status_id').references('id').inTable('repair_order_statuses').onDelete('CASCADE');

        table.uuid('admin_id').notNullable();
        table.foreign('admin_id').references('id').inTable('admins').onDelete('CASCADE');

        table.boolean('can_add').defaultTo(true);
        table.boolean('can_view').defaultTo(true);
        table.boolean('can_update').defaultTo(true);
        table.boolean('can_delete').defaultTo(true);
        table.boolean('can_payment_add').defaultTo(true);
        table.boolean('can_payment_cancel').defaultTo(true);
        table.boolean('can_assign_admin').defaultTo(true);
        table.boolean('can_notification').defaultTo(true);
        table.boolean('can_notification_bot').defaultTo(false);
        table.boolean('can_change_active').defaultTo(true);
        table.boolean('can_change_status').defaultTo(true);
        table.boolean('can_view_initial_problems').defaultTo(true);
        table.boolean('can_change_initial_problems').defaultTo(true);
        table.boolean('can_view_final_problems').defaultTo(true);
        table.boolean('can_change_final_problems').defaultTo(true);
        table.boolean('can_comment').defaultTo(true);
        table.boolean('can_pickup_manage').defaultTo(true);
        table.boolean('can_delivery_manage').defaultTo(true);
        table.boolean('can_view_payments').defaultTo(true);
        table.boolean('can_view_history').defaultTo(true);

        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());

        table.unique(['branch_id', 'status_id', 'admin_id']);
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('repair_order_status_permissions');
};
