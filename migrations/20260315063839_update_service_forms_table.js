/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('service_forms', (table) => {
    table.jsonb('pattern').nullable();
    table.jsonb('device_points').nullable();
    table.jsonb('form').nullable();
    table.jsonb('checklist').nullable();
    table.text('comments').nullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.alterTable('service_forms', (table) => {
    table.dropColumn('pattern');
    table.dropColumn('device_points');
    table.dropColumn('form');
    table.dropColumn('checklist');
    table.dropColumn('comments');
  });
};
