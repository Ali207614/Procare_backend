const { v4: uuidv4 } = require('uuid');

exports.seed = async function (knex) {
  await knex('repair_order_final_problems').del();

  // Get repair orders that have initial problems (some orders may have final problems after diagnosis)
  const repairOrders = await knex('repair_orders')
    .select('repair_orders.id', 'repair_order_initial_problems.problem_category_id')
    .leftJoin('repair_order_initial_problems', 'repair_orders.id', 'repair_order_initial_problems.repair_order_id')
    .where('repair_orders.status', 'Open')
    .whereNotNull('repair_order_initial_problems.id')
    .limit(5); // Only some orders have final problems (after diagnosis)

  if (repairOrders.length === 0) {
    console.log('No repair orders with initial problems found.');
    return;
  }

  // Get problem categories
  const problemCategories = await knex('problem_categories')
    .select('id', 'price', 'estimated_minutes')
    .whereNotNull('parent_id')
    .where('status', 'Open');

  if (problemCategories.length === 0) {
    console.log('No problem categories found.');
    return;
  }

  // Get admins
  const admins = await knex('admins').select('id').where('status', 'Open').limit(1);
  const adminId = admins[0]?.id || '00000000-0000-0000-0000-000000000000';

  const finalProblems = [];

  for (const order of repairOrders) {
    // Use the same problem category as initial, or a related one
    const problemCategoryId = order.problem_category_id;
    const problem = problemCategories.find(p => p.id === problemCategoryId);

    if (problem) {
      // Sometimes final diagnosis might be slightly different (more specific)
      // For seed data, we'll use the same category but with potentially adjusted price
      finalProblems.push({
        id: uuidv4(),
        repair_order_id: order.id,
        problem_category_id: problemCategoryId,
        price: problem.price + (Math.random() * 50000 - 25000), // Small variation
        estimated_minutes: problem.estimated_minutes,
        created_by: adminId,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
      });
    }
  }

  if (finalProblems.length > 0) {
    await knex('repair_order_final_problems').insert(finalProblems);
  }
};
