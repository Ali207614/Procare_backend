exports.up = async function (knex) {
  await knex.schema.createTable('branches', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    table.string('name_uz').notNullable();
    table.string('name_ru').notNullable();
    table.string('name_en').notNullable();

    table.string('address_uz');
    table.string('address_ru');
    table.string('address_en');

    table.boolean('is_protected').defaultTo(false);
    table.boolean('can_user_view').defaultTo(true);

    table.decimal('lat', 10, 7);
    table.decimal('long', 10, 7);
    table.string('support_phone');
    table.time('work_start_time');
    table.time('work_end_time');

    table.string('bg_color');
    table.string('color');
    table.enu('status', ['Open', 'Deleted']).defaultTo('Open');
    table.integer('sort').notNullable().defaultTo(1);
    table.boolean('is_active').defaultTo(true);

    table.uuid('created_by').nullable().references('id').inTable('admins').onDelete('SET NULL');

    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('branches');
};
