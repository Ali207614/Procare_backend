/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 *
 * Adds two status-gate permission flags to `repair_order_status_permissions`:
 *   - cannot_continue_without_reject_cause
 *   - cannot_continue_without_agreed_date
 *
 * Fully idempotent — skips each column if it already exists.
 */
exports.up = async function (knex) {
  const table = 'repair_order_status_permissions';

  const hasRejectCause = await knex.schema.hasColumn(table, 'cannot_continue_without_reject_cause');
  if (!hasRejectCause) {
    await knex.schema.alterTable(table, (t) => {
      t.boolean('cannot_continue_without_reject_cause').defaultTo(false);
    });
  }

  const hasAgreedDate = await knex.schema.hasColumn(table, 'cannot_continue_without_agreed_date');
  if (!hasAgreedDate) {
    await knex.schema.alterTable(table, (t) => {
      t.boolean('cannot_continue_without_agreed_date').defaultTo(false);
    });
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  const table = 'repair_order_status_permissions';

  const hasAgreedDate = await knex.schema.hasColumn(table, 'cannot_continue_without_agreed_date');
  if (hasAgreedDate) {
    await knex.schema.alterTable(table, (t) => {
      t.dropColumn('cannot_continue_without_agreed_date');
    });
  }

  const hasRejectCause = await knex.schema.hasColumn(table, 'cannot_continue_without_reject_cause');
  if (hasRejectCause) {
    await knex.schema.alterTable(table, (t) => {
      t.dropColumn('cannot_continue_without_reject_cause');
    });
  }
};
