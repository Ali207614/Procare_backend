const { v4: uuidv4 } = require('uuid');

exports.seed = async function (knex) {
  await knex('repair_order_assign_admins').del();

  // Get repair orders
  const repairOrders = await knex('repair_orders')
    .select('id', 'branch_id')
    .where('status', 'Open')
    .limit(10);

  if (repairOrders.length === 0) {
    console.log('No repair orders found.');
    return;
  }

  // Get admins (technicians/managers who can be assigned)
  const admins = await knex('admins')
    .select('id', 'first_name', 'last_name')
    .where('status', 'Open')
    .where('is_active', true)
    .limit(5);

  if (admins.length === 0) {
    console.log('No admins found.');
    return;
  }

  const assignments = [];

  for (const order of repairOrders) {
    // Assign 1-2 admins per order (some orders might have multiple technicians)
    const numAdmins = Math.random() > 0.7 ? 2 : 1;
    const assignedAdminIds = new Set();

    for (let i = 0; i < numAdmins && assignedAdminIds.size < admins.length; i++) {
      const admin = admins[Math.floor(Math.random() * admins.length)];
      if (!assignedAdminIds.has(admin.id)) {
        assignedAdminIds.add(admin.id);
        assignments.push({
          id: uuidv4(),
          repair_order_id: order.id,
          admin_id: admin.id,
          created_at: knex.fn.now(),
        });
      }
    }
  }

  if (assignments.length > 0) {
    await knex('repair_order_assign_admins').insert(assignments);
  }
};
