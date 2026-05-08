exports.up = function(knex) {
  return knex.schema.createTable('repair_order_attachments', function(table) {
    table.uuid('id').primary();
    table.uuid('repair_order_id').notNullable()
      .references('id').inTable('repair_orders').onDelete('CASCADE');
    table.string('original_name', 255).notNullable();
    table.string('file_name', 255).notNullable();
    table.text('file_path').notNullable();
    table.integer('file_size').notNullable();
    table.string('mime_type', 100).notNullable();
    table.text('description');
    table.uuid('uploaded_by').notNullable()
      .references('id').inTable('admins').onDelete('RESTRICT');
    table.timestamps(true, true);

    table.index(['repair_order_id']);
    table.index(['uploaded_by']);
    table.index(['created_at']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('repair_order_attachments');
};