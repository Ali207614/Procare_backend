const { v4: uuidv4 } = require('uuid');

exports.seed = async function (knex) {
  await knex('repair_order_initial_problems').del();

  // Get repair orders
  const repairOrders = await knex('repair_orders')
    .select('id', 'phone_category_id')
    .where('status', 'Open')
    .limit(10);

  if (repairOrders.length === 0) {
    console.log('No repair orders found. Seed repair orders first.');
    return;
  }

  // Get problem categories
  const problemCategories = await knex('problem_categories')
    .select('id', 'price', 'estimated_minutes')
    .whereNotNull('parent_id')
    .where('status', 'Open');

  if (problemCategories.length === 0) {
    console.log('No problem categories found. Seed problem categories first.');
    return;
  }

  // Get admins
  const admins = await knex('admins').select('id').where('status', 'Open').limit(1);
  const adminId = admins[0]?.id || '00000000-0000-0000-0000-000000000000';

  const initialProblems = [];

  for (const order of repairOrders) {
    // Assign a problem category to each order
    // Use common problems that match phone types
    let problemCategoryId = null;
    let problemPrice = 0;
    let problemMinutes = 0;

    // Assign common problems (screen, battery, charging issues are most common)
    const commonProblemIds = [
      '20000000-0000-0000-0000-000000000011', // Ekran singan
      '20000000-0000-0000-0000-000000000021', // Batareya tez tugaydi
      '20000000-0000-0000-0000-000000000051', // Zaryadlanmaydi
      '20000000-0000-0000-0000-000000000013', // Sensorli ekran ishlamaydi
      '20000000-0000-0000-0000-000000000031', // Ovoz chiqmaydi
    ];

    // Pick a random common problem
    const selectedProblemId = commonProblemIds[Math.floor(Math.random() * commonProblemIds.length)];
    const problem = problemCategories.find(p => p.id === selectedProblemId);

    if (problem) {
      problemCategoryId = problem.id;
      problemPrice = problem.price;
      problemMinutes = problem.estimated_minutes;
    } else if (problemCategories.length > 0) {
      // Fallback to any available problem
      const randomProblem = problemCategories[Math.floor(Math.random() * problemCategories.length)];
      problemCategoryId = randomProblem.id;
      problemPrice = randomProblem.price;
      problemMinutes = randomProblem.estimated_minutes;
    }

    if (problemCategoryId) {
      initialProblems.push({
        id: uuidv4(),
        repair_order_id: order.id,
        problem_category_id: problemCategoryId,
        price: problemPrice,
        estimated_minutes: problemMinutes,
        created_by: adminId,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
      });
    }
  }

  if (initialProblems.length > 0) {
    await knex('repair_order_initial_problems').insert(initialProblems);
  }
};
