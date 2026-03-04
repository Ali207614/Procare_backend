const { v4: uuidv4 } = require('uuid');

exports.seed = async function (knex) {
  await knex('repair_order_assign_admins').del();

  const repairOrders = await knex('repair_orders').limit(5);
  const admins = await knex('admins').limit(3);

  if (!repairOrders.length || admins.length < 2) {
    console.log('Not enough repair orders or admins found. Skipping repair_order_assign_admins seed.');
    return;
  }

  const assignments = [];

  for (let i = 0; i < repairOrders.length; i++) {
    // Assign 1 or 2 admins to each repair order to simulate mechanics
    assignments.push({
      id: uuidv4(),
      admin_id: admins[i % admins.length].id,
      repair_order_id: repairOrders[i].id,
      created_at: knex.fn.now(),
    });
  }

  await knex('repair_order_assign_admins').insert(assignments);
};
