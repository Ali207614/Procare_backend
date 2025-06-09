exports.up = async function (knex) {
    // PGCrypto extension (uuid uchun)
    await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

    await knex.schema.createTable('users', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

        table.string('name').nullable();
        table.string('phone_number').notNullable().unique();
        table.boolean('phone_verified').defaultTo(false);
        table.string('verification_code').nullable();

        table.string('username').unique().nullable();
        table.string('password').nullable();
        table.string('language').defaultTo('uz');
        table.string('region').nullable();
        table.string('profile_image').nullable();

        table.boolean('is_active').defaultTo(true);
        table.enu('status', ['Open', 'Deleted', 'Banned']).defaultTo('Open');

        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('users');
};
