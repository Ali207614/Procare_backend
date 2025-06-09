exports.up = async function (knex) {
    await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

    await knex.schema.createTable('admins', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.string('name');
        table.string('phone_nummber');
        table.boolean('phone_verified').defaultTo(false);
        table.string('verification_code');
        table.string('username').notNullable().unique();
        table.string('password').notNullable();
        table.string('language').defaultTo('uz');

        table.boolean('is_active').defaultTo(true);
        table.enu('status', ['Open', 'Deleted']).defaultTo('Open');

        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });


};

exports.down = async function (knex) {

    await knex.schema.dropTableIfExists('admins');
};
