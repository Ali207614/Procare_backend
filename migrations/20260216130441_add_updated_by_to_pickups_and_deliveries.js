exports.up = async function (knex) {
  await knex.schema.table('repair_order_pickups', (table) => {
    table.uuid('updated_by').nullable().references('id').inTable('admins').onDelete('SET NULL');
  });

  await knex.schema.table('repair_order_deliveries', (table) => {
    table.uuid('updated_by').nullable().references('id').inTable('admins').onDelete('SET NULL');
  });
};

exports.down = async function (knex) {
  await knex.schema.table('repair_order_pickups', (table) => {
    table.dropColumn('updated_by');
  });

  await knex.schema.table('repair_order_deliveries', (table) => {
    table.dropColumn('updated_by');
  });
};
