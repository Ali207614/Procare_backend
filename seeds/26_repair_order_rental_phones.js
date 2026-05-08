const { v4: uuidv4 } = require('uuid');

exports.seed = async function (knex) {
  await knex('repair_order_rental_phones').del();

  const repairOrders = await knex('repair_orders').limit(5);
  const rentalDevices = await knex('rental_phone_devices').where('is_available', true).limit(2);
  const admin = await knex('admins').first();

  if (!repairOrders.length || !rentalDevices.length || !admin) {
    console.log('Missing data needed for repair_order_rental_phones. Skipping seed.');
    return;
  }

  const rentals = [];

  for (let i = 0; i < rentalDevices.length; i++) {
    rentals.push({
      id: uuidv4(),
      repair_order_id: repairOrders[i].id,
      rental_phone_device_id: rentalDevices[i].id,
      external_order_id: `EXT_RENT_${1000 + i}`,
      is_free: rentalDevices[i].is_free,
      price: rentalDevices[i].is_free ? 0 : rentalDevices[i].daily_rent_price,
      currency: rentalDevices[i].currency,
      status: 'Active',
      rented_at: knex.fn.now(),
      notes: 'Customer needed replacement while screen was being shipped.',
      created_by: admin.id,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    });
  }

  if (rentals.length > 0) {
    await knex('repair_order_rental_phones').insert(rentals);
  }
};
