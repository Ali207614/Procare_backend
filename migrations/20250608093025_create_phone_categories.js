exports.up = async function (knex) {
    await knex.schema.createTable('phone_categories', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

        table.string('name_uz').notNullable();
        table.string('name_ru').notNullable();
        table.string('name_en').notNullable();

        table.string('type').notNullable(); // OS, Brand, Model, SubModel
        table.uuid('parent_id').nullable();
        table.foreign('parent_id').references('id').inTable('phone_categories').onDelete('CASCADE');

        table.integer('sort').notNullable().defaultTo(1);

        table.boolean('is_active').defaultTo(true);
        table.enu('status', ['Open', 'Deleted']).defaultTo('Open');
        table.uuid('created_by').nullable();
        table.foreign('created_by').references('id').inTable('admins').onDelete('SET NULL');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());

        table.unique(['name_uz', 'parent_id']); // uniques bo'lishi uchun qilingan
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('phone_categories');
};
