exports.up = async function (knex) {
  // Remove external system columns from users table
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('customer_code');
  });

  // Remove external system columns from rental_phone_devices table
  await knex.schema.alterTable('rental_phone_devices', (table) => {
    table.dropColumn('is_synced_external');
  });

  // Remove the entire rental_phone_devices table as it's external system specific
  // and replace it with enhanced rental_phones table functionality
  await knex.schema.dropTableIfExists('rental_phone_devices');

  // Add missing columns to rental_phones table to make it more comprehensive
  await knex.schema.alterTable('rental_phones', (table) => {
    table.string('code').nullable();
    table.string('category').nullable(); // 'smartphone', 'basic', 'premium'
    table.decimal('deposit_amount', 12, 2).defaultTo(0);
    table.date('purchase_date').nullable();
    table.date('warranty_expiry').nullable();
    table.json('specifications').nullable(); // Store phone specs as JSON
    table.string('color').nullable();
    table.string('storage_capacity').nullable();
    table.decimal('market_value', 12, 2).nullable();
    table.string('supplier').nullable();
    table.string('location').nullable(); // Where the phone is physically stored
  });
};

exports.down = async function (knex) {
  // Restore external system columns to users table
  await knex.schema.alterTable('users', (table) => {
    table.string('customer_code').unique().nullable();
  });

  // Recreate rental_phone_devices table
  await knex.schema.createTable('rental_phone_devices', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('code').notNullable().unique();
    table.string('name').notNullable();
    table.boolean('is_free').notNullable().defaultTo(false);
    table.decimal('price', 12, 2).nullable();
    table.enu('currency', ['UZS', 'USD', 'EUR']).nullable();
    table.boolean('is_available').notNullable().defaultTo(true);
    table.boolean('is_synced_external').notNullable().defaultTo(false);
    table.text('notes').nullable();
    table.integer('sort').defaultTo(1).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  // Remove added columns from rental_phones table
  await knex.schema.alterTable('rental_phones', (table) => {
    table.dropColumns([
      'code',
      'category',
      'deposit_amount',
      'purchase_date',
      'warranty_expiry',
      'specifications',
      'color',
      'storage_capacity',
      'market_value',
      'supplier',
      'location'
    ]);
  });
};