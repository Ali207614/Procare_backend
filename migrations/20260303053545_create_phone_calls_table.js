exports.up = async function (knex) {
  await knex.schema.createTable('phone_calls', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('uuid').unique().notNullable().comment('The session ID from onlinePBX');
    table.string('caller').nullable();
    table.string('callee').nullable();
    table.string('direction').nullable().comment('inbound, outbound, local');
    table.string('event').nullable().comment('Stores the latest event: call_start, call_answered, call_end, call_missed');
    table.integer('call_duration').nullable();
    table.integer('dialog_duration').nullable();
    table.string('hangup_cause').nullable();
    table.string('download_url').nullable();

    table.uuid('user_id').references('id').inTable('users').onDelete('SET NULL').nullable();
    table
      .uuid('repair_order_id')
      .references('id')
      .inTable('repair_orders')
      .onDelete('SET NULL')
      .nullable();

    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('phone_calls');
};
