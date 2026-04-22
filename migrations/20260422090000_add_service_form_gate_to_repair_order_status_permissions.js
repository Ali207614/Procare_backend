/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 *
 * Adds an optional status-gate permission flag:
 *   - cannot_continue_without_service_form
 */
exports.up = async function (knex) {
  const table = 'repair_order_status_permissions';

  const hasServiceForm = await knex.schema.hasColumn(table, 'cannot_continue_without_service_form');
  if (!hasServiceForm) {
    await knex.schema.alterTable(table, (t) => {
      t.boolean('cannot_continue_without_service_form').defaultTo(false);
    });
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  const table = 'repair_order_status_permissions';

  const hasServiceForm = await knex.schema.hasColumn(table, 'cannot_continue_without_service_form');
  if (hasServiceForm) {
    await knex.schema.alterTable(table, (t) => {
      t.dropColumn('cannot_continue_without_service_form');
    });
  }
};
