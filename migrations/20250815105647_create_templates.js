exports.up = async function (knex) {
  await knex.schema.createTable('templates', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    table.string('title').notNullable();
    table.enu('language', ['uz', 'ru', 'en']).defaultTo('uz').notNullable();
    table.text('body').notNullable();
    table.jsonb('variables').defaultTo(knex.raw("'{}'::jsonb")).nullable();
    table.enu('status', ['draft', 'active', 'archived']).defaultTo('draft').notNullable();
    table.uuid('created_by').references('id').inTable('admins').onDelete('SET NULL').notNullable();
    table.integer('used_count').defaultTo(0).notNullable();

    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('templates');
};
