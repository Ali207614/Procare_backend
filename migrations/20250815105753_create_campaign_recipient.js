exports.up = async function (knex) {
  await knex.schema.createTable('campaign_recipient', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    table
      .uuid('campaign_id')
      .references('id')
      .inTable('campaigns')
      .onDelete('CASCADE')
      .notNullable();
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable();
    table.bigInteger('message_id').nullable();
    table
      .enu('status', ['pending', 'sent', 'delivered', 'read', 'failed', 'blocked', 'unsubscribed'])
      .defaultTo('pending')
      .notNullable();
    table.timestamp('sent_at').nullable();
    table.timestamp('delivered_at').nullable();
    table.timestamp('read_at').nullable();
    table.text('error').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('campaign_recipient');
};
