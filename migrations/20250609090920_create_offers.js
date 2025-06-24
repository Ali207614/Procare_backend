exports.up = async function (knex) {
  await knex.schema.createTable('offers', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    table.text('content_uz').notNullable();
    table.text('content_ru').notNullable();
    table.text('content_en').notNullable();

    table.string('version').notNullable().unique();

    table.boolean('is_active').defaultTo(true);
    table.enu('status', ['Open', 'Deleted']).defaultTo('Open');

    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('offers');
};
