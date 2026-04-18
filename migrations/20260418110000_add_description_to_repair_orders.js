exports.up = async function (knex) {
  await knex.schema.alterTable('repair_orders', (table) => {
    table.text('description').nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('repair_orders', (table) => {
    table.dropColumn('description');
  });
};
