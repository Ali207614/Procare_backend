exports.up = async function (knex) {
    await knex.schema.createTable('phone_categories', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.string('name_uz').notNullable();
        table.string('name_ru').notNullable();
        table.string('name_en').notNullable();
        table.string('telegram_sticker').nullable();
        table.uuid('phone_os_type_id').nullable().references('id').inTable('phone_os_types').onDelete('SET NULL');;
        table.uuid('parent_id').nullable().references('id').inTable('phone_categories').onDelete('CASCADE');
        table.integer('sort').notNullable().defaultTo(1);
        table.enum('status', ['Open', 'Deleted']).defaultTo('Open');
        table.boolean('is_active').defaultTo(true);
        table.uuid('created_by').nullable().references('id').inTable('admins').onDelete('SET NULL');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());

        table.unique(['name_uz', 'parent_id']);
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('phone_categories');
};
