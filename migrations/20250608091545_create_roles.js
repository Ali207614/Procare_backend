exports.up = async function (knex) {
    await knex.schema.createTable('roles', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.string('name').notNullable().unique();
        table.boolean('is_active').defaultTo(true);
        table.enu('status', ['Open', 'Deleted']).defaultTo('Open');
        table.uuid('created_by').nullable();
        table.foreign('created_by').references('id').inTable('admins').onDelete('SET NULL');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });

    await knex.schema.createTable('role_permissions', (table) => {
        table.uuid('role_id').notNullable();
        table.uuid('permission_id').notNullable();

        table.primary(['role_id', 'permission_id']);

        table.foreign('role_id').references('id').inTable('roles').onDelete('CASCADE');
        table.foreign('permission_id').references('id').inTable('permissions').onDelete('CASCADE');
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('role_permissions');
    await knex.schema.dropTableIfExists('roles');
};
