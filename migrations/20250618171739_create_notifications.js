exports.up = async function (knex) {
    await knex.schema.createTable('notifications', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

        table.uuid('admin_id')
            .notNullable()
            .references('id')
            .inTable('admins')
            .onDelete('CASCADE');

        table.string('title').notNullable();
        table.text('message').notNullable();

        table.enum('type', ['info', 'success', 'warning', 'error', 'custom'])
            .notNullable()
            .defaultTo('info');

        table.boolean('is_read')
            .notNullable()
            .defaultTo(false);

        table.jsonb('meta').nullable();

        table.timestamp('read_at').nullable();
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
};


exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('notifications');
};