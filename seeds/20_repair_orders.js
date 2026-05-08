const { v4: uuidv4 } = require('uuid');

exports.seed = async function (knex) {
  // Clear related tables in reverse order of dependencies
  await knex('repair_order_payments').del();
  await knex('repair_order_comments').del();
  await knex('repair_order_parts').del();
  await knex('repair_order_initial_problems').del();
  await knex('repair_orders').del();

  // Fetch required foreign keys smoothly without failing if tables are surprisingly empty
  const users = await knex('users').limit(100);
  const branches = await knex('branches');
  const admin = await knex('admins').first();
  const phoneCategory = await knex('phone_categories').first();
  const statuses = await knex('repair_order_statuses').where('is_active', true);
  const problemCategory = await knex('problem_categories').first();
  const repairPart = await knex('repair_parts').first();

  if (!users.length || !branches.length || !admin || !phoneCategory || !statuses.length) {
    console.log('Missing essential data (users/branches/admin/phone_categories/statuses) — Skipping repair_orders seed.');
    return;
  }

  const repairOrders = [];
  const initialProblems = [];
  const usedParts = [];
  const comments = [];
  const payments = [];

  let orderCount = 0;
  for (const branch of branches) {
    for (let i = 0; i < 20; i++) {
      const user = users[(orderCount) % users.length];
      const status = statuses[(orderCount) % statuses.length];

      const repairOrderId = uuidv4();

      // 1. Repair Order
      repairOrders.push({
        id: repairOrderId,
        user_id: user.id,
        branch_id: branch.id,
        phone_category_id: phoneCategory.id,
        status_id: status.id,
        total: 100000 + (Math.random() * 500000), // Random total between 100k and 600k
        imei: `35${Math.floor(Math.random() * 9000000000000) + 1000000000000}`,
        delivery_method: i % 2 === 0 ? 'Self' : 'Delivery',
        pickup_method: i % 3 === 0 ? 'Pickup' : 'Self',
        priority: i % 4 === 0 ? 'High' : 'Medium',
        priority_level: i % 4 === 0 ? 3 : 2,
        created_by: admin.id,
        status: 'Open',
        source: 'Telegram',
        phone_number: user.phone_number1,
        name: `${user.first_name} ${user.last_name}`,
        created_at: new Date(Date.now() - orderCount * 3600000), // Spread out by hours
        updated_at: new Date(Date.now() - orderCount * 3600000),
      });

      // 2. Initial Problems
      if (problemCategory) {
        const problemId = uuidv4();
        const problemPrice = 50000 + ((orderCount % 10) * 10000);
        
        initialProblems.push({
          id: problemId,
          repair_order_id: repairOrderId,
          problem_category_id: problemCategory.id,
          price: problemPrice,
          estimated_minutes: 60 + (orderCount % 20) * 10,
          created_by: admin.id,
          created_at: knex.fn.now(),
          updated_at: knex.fn.now(),
        });

        // 3. Parts (using the initial problem)
        if (repairPart && orderCount % 2 === 0) {
          usedParts.push({
            id: uuidv4(),
            repair_order_id: repairOrderId,
            repair_order_initial_problem_id: problemId,
            repair_part_id: repairPart.id,
            quantity: 1,
            part_price: 120000,
            created_by: admin.id,
            created_at: knex.fn.now(),
            updated_at: knex.fn.now(),
          });
        }
      }

      // 4. Comments
      comments.push({
        id: uuidv4(),
        repair_order_id: repairOrderId,
        text: orderCount % 2 === 0 ? 'Customer was very responsive.' : 'Waiting for spare part delivery.',
        status: 'Open',
        created_by: admin.id,
        status_by: status.id, // linked to the status it was at the time
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
      });

      // 5. Payments (some have payments)
      if (orderCount % 3 === 0) {
        payments.push({
          id: uuidv4(),
          repair_order_id: repairOrderId,
          amount: 50000,
          type: orderCount % 2 === 0 ? 'cash' : 'transfer',
          created_at: knex.fn.now(),
          updated_at: knex.fn.now(),
        });
      }

      orderCount++;
    }
  }

  // Insert in chunks if necessary, but 400 is usually fine for one insert
  await knex('repair_orders').insert(repairOrders);
  if (initialProblems.length > 0) await knex('repair_order_initial_problems').insert(initialProblems);
  if (usedParts.length > 0) await knex('repair_order_parts').insert(usedParts);
  if (comments.length > 0) await knex('repair_order_comments').insert(comments);
  if (payments.length > 0) await knex('repair_order_payments').insert(payments);

};
