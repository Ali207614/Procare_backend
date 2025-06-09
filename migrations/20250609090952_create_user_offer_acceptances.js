exports.up = async function (knex) {
    await knex.schema.createTable('user_offer_acceptances', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

        table.uuid('user_id').notNullable();
        table.uuid('offer_id').notNullable();

        table.timestamp('accepted_at').defaultTo(knex.fn.now());

        table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
        table.foreign('offer_id').references('id').inTable('offers').onDelete('CASCADE');
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('user_offer_acceptances');
};
