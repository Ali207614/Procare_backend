/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // 1. Clean up existing duplicates
  await knex.raw(`
    DELETE FROM repair_order_assign_admins a
    USING repair_order_assign_admins b
    WHERE a.id > b.id
      AND a.repair_order_id = b.repair_order_id
      AND a.admin_id = b.admin_id;
  `);

  // 2. Add unique constraint
  await knex.schema.alterTable('repair_order_assign_admins', (table) => {
    table.unique(['repair_order_id', 'admin_id'], 'repair_order_assign_admins_order_id_admin_id_unique');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.alterTable('repair_order_assign_admins', (table) => {
    table.dropUnique(['repair_order_id', 'admin_id'], 'repair_order_assign_admins_order_id_admin_id_unique');
  });
};
