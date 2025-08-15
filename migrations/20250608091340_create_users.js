exports.up = async function (knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    table.string('sap_card_code').unique().nullable();
    table.string('first_name');
    table.string('last_name');
    table.string('phone_number').unique().notNullable();
    table.boolean('phone_verified').defaultTo(false);
    table.string('verification_code');
    table.string('password');

    table.string('passport_series');
    table.date('birth_date');
    table.string('id_card_number');
    table.string('language').defaultTo('uz');

    table.bigInteger('telegram_chat_id').unique().nullable();
    table.string('telegram_username').nullable();

    table
      .enu('source', ['telegram_bot', 'employee', 'web', 'app', 'other'])
      .defaultTo('other')
      .nullable();
    table.uuid('created_by').references('id').inTable('admins').onDelete('SET NULL').nullable();

    table.boolean('is_active').defaultTo(true);
    table.enu('status', ['Pending', 'Open', 'Deleted', 'Banned']).defaultTo('Open');

    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.unique(['id', 'phone_number']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('users');
};
