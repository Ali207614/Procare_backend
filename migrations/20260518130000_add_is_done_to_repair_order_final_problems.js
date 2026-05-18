exports.up = async function (knex) {
  const hasColumn = await knex.schema.hasColumn('repair_order_final_problems', 'is_done');
  if (!hasColumn) {
    await knex.schema.alterTable('repair_order_final_problems', (table) => {
      table.boolean('is_done').notNullable().defaultTo(false);
    });
  }
};

exports.down = async function (knex) {
  const hasColumn = await knex.schema.hasColumn('repair_order_final_problems', 'is_done');
  if (hasColumn) {
    await knex.schema.alterTable('repair_order_final_problems', (table) => {
      table.dropColumn('is_done');
    });
  }
};
