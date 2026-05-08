exports.up = async function (knex) {
  await knex.schema.createTable('repair_order_parts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    table
      .uuid('repair_order_id')
      .notNullable()
      .references('id')
      .inTable('repair_orders')
      .onDelete('CASCADE');

    table
      .uuid('repair_order_initial_problem_id')
      .nullable()
      .references('id')
      .inTable('repair_order_initial_problems')
      .onDelete('CASCADE');

    table
      .uuid('repair_order_final_problem_id')
      .nullable()
      .references('id')
      .inTable('repair_order_final_problems')
      .onDelete('CASCADE');

    table
      .uuid('repair_part_id')
      .notNullable()
      .references('id')
      .inTable('repair_parts')
      .onDelete('RESTRICT');

    table.integer('quantity').notNullable().defaultTo(1);
    table.decimal('part_price', 12, 2).notNullable();

    table.uuid('created_by').notNullable().references('id').inTable('admins').onDelete('RESTRICT');

    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes
    table.index(['repair_order_id', 'repair_order_initial_problem_id', 'repair_part_id']);
    table.index(['repair_order_id', 'repair_order_final_problem_id', 'repair_part_id']);

    // Explicit constraint names to avoid conflicts
    table.unique(
      ['repair_order_id', 'repair_order_initial_problem_id', 'repair_part_id'],
      'uq_repair_order_parts_initial_unique',
    );
    table.unique(
      ['repair_order_id', 'repair_order_final_problem_id', 'repair_part_id'],
      'uq_repair_order_parts_final_unique',
    );
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('repair_order_parts');
};
