exports.up = async function (knex) {
  await knex.schema.createTable('repair_parts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('part_name_uz', 255).notNullable();
    table.string('part_name_ru', 255).notNullable();
    table.string('part_name_en', 255).notNullable();
    table.decimal('part_price', 12, 2).notNullable().defaultTo(0);
    table.integer('quantity').notNullable().defaultTo(1);
    table.text('description_uz').nullable();
    table.text('description_ru').nullable();
    table.text('description_en').nullable();
    table.enum('status', ['Open', 'Deleted']).defaultTo('Available');
    table.uuid('created_by').nullable().references('id').inTable('admins').onDelete('SET NULL');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('repair_part_assignments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    table
      .uuid('repair_part_id')
      .notNullable()
      .references('id')
      .inTable('repair_parts')
      .onDelete('CASCADE');

    table
      .uuid('problem_category_id')
      .notNullable()
      .references('id')
      .inTable('problem_categories')
      .onDelete('CASCADE');

    table.boolean('is_required').notNullable().defaultTo(false);

    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.unique(['repair_part_id', 'problem_category_id']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('repair_part_assignments');
  await knex.schema.dropTableIfExists('repair_parts');
};
