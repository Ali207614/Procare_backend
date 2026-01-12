const { v4: uuidv4 } = require('uuid');

exports.seed = async function (knex) {
  await knex('repair_order_parts').del();

  // Get repair orders with final problems (parts are usually assigned after final diagnosis)
  const repairOrders = await knex('repair_orders')
    .select('repair_orders.id', 'repair_order_final_problems.id as final_problem_id', 'repair_orders.phone_category_id')
    .leftJoin('repair_order_final_problems', 'repair_orders.id', 'repair_order_final_problems.repair_order_id')
    .where('repair_orders.status', 'Open')
    .whereNotNull('repair_order_final_problems.id')
    .limit(5);

  if (repairOrders.length === 0) {
    console.log('No repair orders with final problems found.');
    return;
  }

  // Get repair parts
  const repairParts = await knex('repair_parts')
    .select('id', 'selling_price')
    .where('status', 'Open')
    .where('is_active', true);

  if (repairParts.length === 0) {
    console.log('No repair parts found.');
    return;
  }

  // Get admins
  const admins = await knex('admins').select('id').where('status', 'Open').limit(1);
  const adminId = admins[0]?.id || '00000000-0000-0000-0000-000000000000';

  const orderParts = [];

  // Common parts needed for common problems
  const commonParts = {
    screen: repairParts.filter(p => p.id.includes('Ekran') || p.name_en.toLowerCase().includes('screen')),
    battery: repairParts.filter(p => p.id.includes('Batareya') || p.name_en.toLowerCase().includes('battery')),
    camera: repairParts.filter(p => p.id.includes('Kamera') || p.name_en.toLowerCase().includes('camera')),
    charging: repairParts.filter(p => p.id.includes('Zaryadlash') || p.name_en.toLowerCase().includes('charging') || p.name_en.toLowerCase().includes('cable')),
    speaker: repairParts.filter(p => p.id.includes('Karnay') || p.id.includes('Speaker') || p.name_en.toLowerCase().includes('speaker')),
  };

  for (const order of repairOrders) {
    // Assign 1-2 parts per order based on problem type
    const partsToAssign = [];

    // Randomly assign parts (in real scenario, this would be based on problem category)
    if (commonParts.screen.length > 0 && Math.random() > 0.5) {
      const screenPart = commonParts.screen[Math.floor(Math.random() * commonParts.screen.length)];
      partsToAssign.push({ part: screenPart, quantity: 1 });
    }

    if (commonParts.battery.length > 0 && Math.random() > 0.3) {
      const batteryPart = commonParts.battery[Math.floor(Math.random() * commonParts.battery.length)];
      partsToAssign.push({ part: batteryPart, quantity: 1 });
    }

    if (commonParts.charging.length > 0 && Math.random() > 0.4) {
      const chargingPart = commonParts.charging[Math.floor(Math.random() * commonParts.charging.length)];
      partsToAssign.push({ part: chargingPart, quantity: 1 });
    }

    // If no parts assigned, assign a random one
    if (partsToAssign.length === 0 && repairParts.length > 0) {
      const randomPart = repairParts[Math.floor(Math.random() * repairParts.length)];
      partsToAssign.push({ part: randomPart, quantity: 1 });
    }

    for (const { part, quantity } of partsToAssign) {
      orderParts.push({
        id: uuidv4(),
        repair_order_id: order.id,
        repair_order_initial_problem_id: null,
        repair_order_final_problem_id: order.final_problem_id,
        repair_part_id: part.id,
        quantity: quantity,
        part_price: part.selling_price,
        created_by: adminId,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
      });
    }
  }

  if (orderParts.length > 0) {
    await knex('repair_order_parts').insert(orderParts);
  }
};
