/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.createTable('admin_branches', (table) => {
        table.uuid('admin_id').notNullable();
        table.uuid('branch_id').notNullable();

        table.primary(['admin_id', 'branch_id']);

        table.foreign('admin_id').references('id').inTable('admins').onDelete('CASCADE');
        table.foreign('branch_id').references('id').inTable('branches').onDelete('CASCADE');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('admin_branches');
};
