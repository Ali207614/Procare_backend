exports.up = async function (knex) {
  await knex.schema.createTable('app_features', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('feature_key').notNullable().unique();
    table.string('name').notNullable();
    table.string('description');
    table.boolean('is_active').defaultTo(true);
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex('app_features').insert([
    { feature_key: 'system.operational', name: 'System Operational', is_active: true },
  ]);
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('app_features');
};
