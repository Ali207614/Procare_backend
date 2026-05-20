/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  const hasColumn = await knex.schema.hasColumn('service_forms', 'created_by');
  if (!hasColumn) {
    await knex.schema.alterTable('service_forms', (table) => {
      table
        .uuid('created_by')
        .nullable()
        .references('id')
        .inTable('admins')
        .onDelete('SET NULL');
    });
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  const hasColumn = await knex.schema.hasColumn('service_forms', 'created_by');
  if (hasColumn) {
    await knex.schema.alterTable('service_forms', (table) => {
      table.dropColumn('created_by');
    });
  }
};
