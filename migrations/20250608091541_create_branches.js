exports.up = async function (knex) {
    await knex.schema.createTable('branches', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.string('name').notNullable().unique();
        table.string('bg_color');
        table.string('color');
        table.enu('status', ['Open', 'Deleted']).defaultTo('Open');
        table.integer('sort').notNullable().defaultTo(1);
        table.boolean('is_active').defaultTo(true);

        table.uuid('created_by').nullable();
        table.foreign('created_by').references('id').inTable('admins').onDelete('SET NULL');

        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('branches');
};
