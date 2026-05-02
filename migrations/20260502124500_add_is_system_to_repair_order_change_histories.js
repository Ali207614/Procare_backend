exports.up = async function (knex) {
  const hasColumn = await knex.schema.hasColumn('repair_order_change_histories', 'is_system');
  if (hasColumn) {
    return;
  }

  await knex.schema.alterTable('repair_order_change_histories', (table) => {
    table.boolean('is_system').notNullable().defaultTo(false);
  });
};

exports.down = async function (knex) {
  const hasColumn = await knex.schema.hasColumn('repair_order_change_histories', 'is_system');
  if (!hasColumn) {
    return;
  }

  await knex.schema.alterTable('repair_order_change_histories', (table) => {
    table.dropColumn('is_system');
  });
};
