exports.up = async function (knex) {
  await knex.schema.createTable('template_histories', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    table
      .uuid('template_id')
      .references('id')
      .inTable('templates')
      .onDelete('CASCADE')
      .notNullable();
    table.integer('version').notNullable();
    table.text('body').notNullable();
    table.jsonb('variables').defaultTo(knex.raw("'{}'::jsonb")).nullable();
    table.uuid('created_by').references('id').inTable('admins').onDelete('SET NULL').notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('template_histories');
};
