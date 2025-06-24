/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.createTable('admin_branches', (table) => {
    table.uuid('admin_id').notNullable().references('id').inTable('admins').onDelete('CASCADE');
    table.uuid('branch_id').notNullable().references('id').inTable('branches').onDelete('CASCADE');

    table.primary(['admin_id', 'branch_id']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('admin_branches');
};
