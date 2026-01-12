exports.up = async function (knex) {
  // Create rental_phone_devices table for local rental management
  await knex.schema.createTable('rental_phone_devices', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    // Device identification
    table.string('code').notNullable().unique(); // Device code
    table.string('name').notNullable(); // Device name/model

    // Device specifications
    table.string('brand').nullable(); // Phone brand (Samsung, iPhone, etc)
    table.string('model').nullable(); // Phone model (Galaxy A14, iPhone 12, etc)
    table.string('imei').nullable(); // IMEI number
    table.string('serial_number').nullable(); // Serial number
    table.string('color').nullable(); // Device color
    table.string('storage_capacity').nullable(); // Storage size (64GB, 128GB, etc)

    // Rental pricing
    table.boolean('is_free').notNullable().defaultTo(false);
    table.decimal('daily_rent_price', 12, 2).notNullable().defaultTo(0);
    table.decimal('deposit_amount', 12, 2).defaultTo(0);
    table.enu('currency', ['UZS', 'USD', 'EUR']).defaultTo('UZS');

    // Availability and status
    table.boolean('is_available').notNullable().defaultTo(true);
    table.enu('status', ['Available', 'Rented', 'Maintenance', 'Lost', 'Damaged', 'Retired']).defaultTo('Available');
    table.enu('condition', ['Excellent', 'Good', 'Fair', 'Poor']).defaultTo('Good');

    // Inventory
    table.integer('quantity').defaultTo(1).notNullable(); // How many units available
    table.integer('quantity_available').defaultTo(1).notNullable(); // Currently available units

    // Additional info
    table.text('notes').nullable();
    table.text('specifications').nullable(); // JSON string for additional specs
    table.integer('sort').defaultTo(1).notNullable();
    table.boolean('is_active').defaultTo(true);

    // Timestamps
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes for performance
    table.index(['code']);
    table.index(['brand', 'model']);
    table.index(['is_available']);
    table.index(['status']);
    table.index(['sort']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('rental_phone_devices');
};