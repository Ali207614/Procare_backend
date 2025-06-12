exports.up = async function (knex) {
    await knex.schema.createTable('phone_os_types', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

        table.string('name_uz').notNullable();
        table.string('name_ru').notNullable();
        table.string('name_en').notNullable();

        table.integer('sort').defaultTo(1).notNullable();
        table.boolean('is_active').defaultTo(true);
        table.enu('status', ['Open', 'Deleted']).defaultTo('Open');

        table.uuid('created_by').nullable();
        table.foreign('created_by').references('id').inTable('admins').onDelete('SET NULL');

        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());

        table.unique(['name_uz']);
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('phone_os_types');
};
