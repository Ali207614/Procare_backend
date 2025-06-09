/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.createTable('admin_roles', (table) => {
        table.uuid('admin_id').notNullable();
        table.uuid('role_id').notNullable();

        table.primary(['admin_id', 'role_id']);

        table.foreign('admin_id').references('id').inTable('admins').onDelete('CASCADE');
        table.foreign('role_id').references('id').inTable('roles').onDelete('CASCADE');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('admin_roles');
};
