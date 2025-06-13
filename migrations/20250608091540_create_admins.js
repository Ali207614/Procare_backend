exports.up = async function (knex) {
    await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

    await knex.schema.createTable('admins', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

        table.string('first_name');
        table.string('last_name');
        table.string('phone_number').unique().notNullable();
        table.boolean('phone_verified').defaultTo(false);
        table.string('verification_code');
        table.string('password');

        table.string('passport_series');
        table.date('birth_date');
        table.date('hire_date');
        table.string('id_card_number');
        table.string('language').defaultTo('uz');

        table.boolean('is_active').defaultTo(true);
        table.enu('status', ['Pending', 'Open', 'Deleted', 'Banned']).defaultTo('Open');

        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });




};

exports.down = async function (knex) {

    await knex.schema.dropTableIfExists('admins');
};
