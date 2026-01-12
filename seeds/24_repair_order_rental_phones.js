const { v4: uuidv4 } = require('uuid');

exports.seed = async function (knex) {
  await knex('repair_order_rental_phones').del();

  // Get repair orders (only some customers need rental phones)
  const repairOrders = await knex('repair_orders')
    .select('id', 'estimated_completion_time')
    .where('status', 'Open')
    .limit(5); // Only a few orders need rental phones

  if (repairOrders.length === 0) {
    console.log('No repair orders found.');
    return;
  }

  // Get available rental phone devices
  const rentalDevices = await knex('rental_phone_devices')
    .select('id', 'daily_rent_price', 'is_free', 'code')
    .where('status', 'Available')
    .where('is_available', true)
    .limit(10);

  if (rentalDevices.length === 0) {
    console.log('No rental phone devices found.');
    return;
  }

  // Get admins
  const admins = await knex('admins').select('id').where('status', 'Open').limit(1);
  const adminId = admins[0]?.id || '00000000-0000-0000-0000-000000000000';

  const rentalPhones = [];

  // Only assign rental phones to some orders (about 30% of orders)
  const ordersNeedingRental = repairOrders.filter(() => Math.random() < 0.3);

  for (const order of ordersNeedingRental) {
    // Prefer free phones, but also use paid ones
    const availableDevices = rentalDevices.filter(d => d.is_available);
    if (availableDevices.length === 0) continue;

    const device = availableDevices[Math.floor(Math.random() * availableDevices.length)];
    const rentedAt = new Date();
    const estimatedDays = Math.ceil((order.estimated_completion_time - rentedAt) / (1000 * 60 * 60 * 24)) || 3;
    const totalPrice = device.is_free ? 0 : device.daily_rent_price * estimatedDays;

    rentalPhones.push({
      id: uuidv4(),
      repair_order_id: order.id,
      rental_phone_device_id: device.id,
      external_order_id: null,
      is_free: device.is_free,
      price: totalPrice,
      currency: 'UZS',
      status: 'Active',
      rented_at: rentedAt,
      returned_at: null,
      notes: `Ijara telefoni ${device.code} - ${estimatedDays} kun`,
      created_by: adminId,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    });
  }

  if (rentalPhones.length > 0) {
    await knex('repair_order_rental_phones').insert(rentalPhones);
  }
};
