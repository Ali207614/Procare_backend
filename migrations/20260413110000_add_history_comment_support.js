exports.up = async function (knex) {
  await knex.schema.alterTable('repair_order_comments', (table) => {
    table.enu('comment_type', ['manual', 'history']).notNullable().defaultTo('manual');
    table
      .uuid('history_change_id')
      .nullable()
      .references('id')
      .inTable('repair_order_change_histories')
      .onDelete('SET NULL')
      .unique();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('repair_order_comments', (table) => {
    table.dropColumn('history_change_id');
    table.dropColumn('comment_type');
  });
};
