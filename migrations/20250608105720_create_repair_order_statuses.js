exports.up = async function (knex) {
  await knex.schema.createTable('repair_order_statuses', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    table.string('name_uz').notNullable();
    table.string('name_ru').notNullable();
    table.string('name_en').notNullable();

    table.string('bg_color').notNullable();
    table.string('color').notNullable();

    table.integer('sort').defaultTo(1).notNullable();

    table.boolean('can_user_view').defaultTo(true);
    table.boolean('is_active').defaultTo(true);

    table.enu('type', ['Completed', 'Cancelled']).nullable();

    table.boolean('is_protected').defaultTo(false);
    table.boolean('can_add_payment').defaultTo(false);

    table.enu('status', ['Open', 'Deleted']).defaultTo('Open');

    table.uuid('branch_id').notNullable().references('id').inTable('branches').onDelete('CASCADE');
    table.uuid('created_by').nullable().references('id').inTable('admins').onDelete('SET NULL');

    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('repair_order_statuses');
};
