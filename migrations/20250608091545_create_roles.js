exports.up = async function (knex) {
    await knex.schema.createTable('roles', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.string('name').notNullable().unique();
        table.boolean('is_active').defaultTo(true);
        table.boolean('is_protected').defaultTo(false);
        table.enu('status', ['Open', 'Deleted']).defaultTo('Open');
        table.uuid('created_by').nullable().references('id').inTable('admins').onDelete('SET NULL');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });

    await knex.schema.createTable('role_permissions', (table) => {
        table.uuid('role_id').notNullable().references('id').inTable('roles').onDelete('CASCADE');
        table.uuid('permission_id').notNullable().references('id').inTable('permissions').onDelete('CASCADE');

        table.primary(['role_id', 'permission_id']);
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('role_permissions');
    await knex.schema.dropTableIfExists('roles');
};
