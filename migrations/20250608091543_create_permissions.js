exports.up = async function (knex) {
  await knex.schema.createTable('permissions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable().unique().index(); // TEXT
    table.string('description');
    table.boolean('is_active').defaultTo(true);
    table.enu('status', ['Open', 'Deleted']).defaultTo('Open');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('permissions');
};
