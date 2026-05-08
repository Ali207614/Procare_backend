exports.up = async function (knex) {
  await knex.schema.createTable('campaigns', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    table
      .uuid('template_id')
      .references('id')
      .inTable('templates')
      .onDelete('SET NULL')
      .notNullable();
    table.jsonb('filters').defaultTo(knex.raw("'{}'::jsonb")).nullable();
    table.enu('send_type', ['now', 'schedule']).defaultTo('now').notNullable();
    table.timestamp('schedule_at').nullable();
    table.jsonb('ab_test').defaultTo(knex.raw("'{}'::jsonb")).nullable();
    table.enu('delivery_method', ['bot', 'app', 'sms']).defaultTo('bot').notNullable();
    table
      .enu('status', [
        'queued',
        'scheduled',
        'sending',
        'paused',
        'completed',
        'failed',
        'canceled',
      ])
      .defaultTo('queued')
      .notNullable();
    table.string('job_id').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('campaigns');
};
