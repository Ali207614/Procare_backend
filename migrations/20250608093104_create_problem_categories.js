exports.up = async function (knex) {
    await knex.schema.createTable('problem_categories', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

        table.string('name_uz').notNullable();
        table.string('name_ru').notNullable();
        table.string('name_en').notNullable();

        table.uuid('parent_id').nullable();
        table.foreign('parent_id').references('id').inTable('problem_categories').onDelete('CASCADE');

        table.decimal('price', 12, 2).notNullable().defaultTo(0);
        table.integer('estimated_minutes').notNullable().defaultTo(0);

        table.integer('sort').notNullable().defaultTo(1);

        table.boolean('is_active').defaultTo(true);
        table.enu('status', ['Open', 'Deleted']).defaultTo('Open');
        table.uuid('created_by').nullable();
        table.foreign('created_by').references('id').inTable('admins').onDelete('SET NULL');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());

        table.unique(['name_uz', 'parent_id']);
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('problem_categories');
};
