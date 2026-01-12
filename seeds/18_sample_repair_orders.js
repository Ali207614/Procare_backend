exports.seed = async function (knex) {
  await knex('repair_orders').del();

  // Get required data for creating repair orders
  const branches = await knex('branches').select('id').where('status', 'Open').limit(2);
  const users = await knex('users').select('id').where('status', 'Open').limit(10);
  const phoneCategories = await knex('phone_categories')
    .select('id')
    .whereNotNull('parent_id')
    .where('status', 'Open')
    .limit(8);
  const admins = await knex('admins').select('id').where('status', 'Open').limit(5);

  if (branches.length === 0 || users.length === 0 || phoneCategories.length === 0) {
    console.log('Required data not found for creating repair orders');
    return;
  }

  // Get status for each branch (we'll use the first status - "New Order")
  const branchStatuses = {};
  for (const branch of branches) {
    const status = await knex('repair_order_statuses')
      .select('id')
      .where({ branch_id: branch.id, sort: 1 })
      .first();
    if (status) {
      branchStatuses[branch.id] = status.id;
    }
  }

  const sampleOrders = [
    {
      id: 'b0000000-0000-0000-0000-000000000001',
      order_number: 'RO-2025-001',
      user_id: users[0]?.id,
      branch_id: branches[0]?.id,
      phone_category_id: phoneCategories[0]?.id, // iPhone 15 Pro Max
      phone_model: 'iPhone 15 Pro Max',
      phone_color: 'Natural Titanium',
      phone_storage: '256GB',
      customer_name: 'Akmal Karimov',
      phone_number: '+998901234567',
      initial_problem_description: 'Ekran sinib ketgan, sensorli ekran ishlamayapti',
      source_type: 'App',
      priority: 'High',
      estimated_cost: 3200000,
      estimated_completion_time: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      pickup_method: 'Self',
      delivery_method: 'Self',
    },
    {
      id: 'b0000000-0000-0000-0000-000000000002',
      order_number: 'RO-2025-002',
      user_id: users[1]?.id,
      branch_id: branches[0]?.id,
      phone_category_id: phoneCategories[1]?.id, // iPhone 15 Pro
      phone_model: 'iPhone 15 Pro',
      phone_color: 'Blue Titanium',
      phone_storage: '128GB',
      customer_name: 'Malika Toshmatova',
      phone_number: '+998901234568',
      initial_problem_description: 'Batareya tez tugaydi, 2-3 soatda zaryaddan tushadi',
      source_type: 'Web',
      priority: 'Medium',
      estimated_cost: 500000,
      estimated_completion_time: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day from now
      pickup_method: 'Pickup',
      delivery_method: 'Delivery',
    },
    {
      id: 'b0000000-0000-0000-0000-000000000003',
      order_number: 'RO-2025-003',
      user_id: users[2]?.id,
      branch_id: branches[0]?.id,
      phone_category_id: phoneCategories[2]?.id, // Galaxy S24 Ultra
      phone_model: 'Samsung Galaxy S24 Ultra',
      phone_color: 'Titanium Black',
      phone_storage: '512GB',
      customer_name: 'Bobur Rashidov',
      phone_number: '+998901234569',
      initial_problem_description: 'Kamera ochilmaydi, xatolik chiqarib turibdi',
      source_type: 'Organic',
      priority: 'High',
      estimated_cost: 800000,
      estimated_completion_time: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      pickup_method: 'Self',
      delivery_method: 'Self',
    },
    {
      id: 'b0000000-0000-0000-0000-000000000004',
      order_number: 'RO-2025-004',
      user_id: users[3]?.id,
      branch_id: branches[1]?.id,
      phone_category_id: phoneCategories[3]?.id, // Galaxy A54
      phone_model: 'Samsung Galaxy A54',
      phone_color: 'Awesome Blue',
      phone_storage: '128GB',
      customer_name: 'Nigora Saidova',
      phone_number: '+998901234570',
      initial_problem_description: 'Zaryadlanmaydi, zaryadlash kabeli ulanganda hech narsa bo\'lmaydi',
      source_type: 'Bot',
      priority: 'Medium',
      estimated_cost: 220000,
      estimated_completion_time: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      pickup_method: 'Pickup',
      delivery_method: 'Delivery',
    },
    {
      id: 'b0000000-0000-0000-0000-000000000005',
      order_number: 'RO-2025-005',
      user_id: users[4]?.id,
      branch_id: branches[1]?.id,
      phone_category_id: phoneCategories[4]?.id, // Mi 14 Ultra
      phone_model: 'Xiaomi Mi 14 Ultra',
      phone_color: 'Black',
      phone_storage: '256GB',
      customer_name: 'Sardor Alimov',
      phone_number: '+998901234571',
      initial_problem_description: 'WiFi va Bluetooth ishlamaydi, ulana olmayapti',
      source_type: 'Meta',
      priority: 'Low',
      estimated_cost: 350000,
      estimated_completion_time: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // 4 days from now
      pickup_method: 'Self',
      delivery_method: 'Self',
    },
    {
      id: 'b0000000-0000-0000-0000-000000000006',
      order_number: 'RO-2025-006',
      user_id: users[5]?.id,
      branch_id: branches[0]?.id,
      phone_category_id: phoneCategories[5]?.id, // Redmi Note 13 Pro
      phone_model: 'Xiaomi Redmi Note 13 Pro',
      phone_color: 'Aurora Purple',
      phone_storage: '256GB',
      customer_name: 'Feruza Normatova',
      phone_number: '+998901234572',
      initial_problem_description: 'Ovoz chiqmaydi, qo\'ng\'iroq vaqtida eshitilmaydi',
      source_type: 'App',
      priority: 'High',
      estimated_cost: 180000,
      estimated_completion_time: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day from now
      pickup_method: 'Self',
      delivery_method: 'Delivery',
    },
    {
      id: 'b0000000-0000-0000-0000-000000000007',
      order_number: 'RO-2025-007',
      user_id: users[6]?.id,
      branch_id: branches[1]?.id,
      phone_category_id: phoneCategories[6]?.id, // POCO X6 Pro
      phone_model: 'POCO X6 Pro',
      phone_color: 'Gray',
      phone_storage: '256GB',
      customer_name: 'Jasur Nazarov',
      phone_number: '+998901234573',
      initial_problem_description: 'Telefon sekin ishlaydi, ilovalar tez-tez to\'xtaydi',
      source_type: 'Web',
      priority: 'Low',
      estimated_cost: 120000,
      estimated_completion_time: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      pickup_method: 'Pickup',
      delivery_method: 'Self',
    },
    {
      id: 'b0000000-0000-0000-0000-000000000008',
      order_number: 'RO-2025-008',
      user_id: users[7]?.id,
      branch_id: branches[0]?.id,
      phone_category_id: phoneCategories[7]?.id, // Find X7 Ultra
      phone_model: 'Oppo Find X7 Ultra',
      phone_color: 'Desert Silver',
      phone_storage: '512GB',
      customer_name: 'Dilnoza Yusupova',
      phone_number: '+998901234574',
      initial_problem_description: 'Ekranda chiziqlar paydo bo\'lgan, ba\'zi joylar sensorga javob bermaydi',
      source_type: 'Other',
      priority: 'Medium',
      estimated_cost: 950000,
      estimated_completion_time: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      pickup_method: 'Self',
      delivery_method: 'Self',
    },
    {
      id: 'b0000000-0000-0000-0000-000000000009',
      order_number: 'RO-2025-009',
      user_id: users[8]?.id,
      branch_id: branches[1]?.id,
      phone_category_id: phoneCategories[0]?.id,
      phone_model: 'iPhone 15 Pro Max',
      phone_color: 'White Titanium',
      phone_storage: '512GB',
      customer_name: 'Olimjon Toshmatov',
      phone_number: '+998901234575',
      initial_problem_description: 'Telefon suvga tushib ketgan, endi ishlamayapti',
      source_type: 'App',
      priority: 'High',
      estimated_cost: 4500000,
      estimated_completion_time: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      pickup_method: 'Pickup',
      delivery_method: 'Delivery',
    },
    {
      id: 'b0000000-0000-0000-0000-000000000010',
      order_number: 'RO-2025-010',
      user_id: users[9]?.id,
      branch_id: branches[0]?.id,
      phone_category_id: phoneCategories[1]?.id,
      phone_model: 'iPhone 15 Pro',
      phone_color: 'Black Titanium',
      phone_storage: '256GB',
      customer_name: 'Gulnora Karimova',
      phone_number: '+998901234576',
      initial_problem_description: 'SIM karta o\'qilmayapti, slot buzilgan bo\'lishi mumkin',
      source_type: 'Web',
      priority: 'Medium',
      estimated_cost: 150000,
      estimated_completion_time: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      pickup_method: 'Self',
      delivery_method: 'Self',
    },
    {
      id: 'b0000000-0000-0000-0000-000000000011',
      order_number: 'RO-2025-011',
      user_id: users[0]?.id,
      branch_id: branches[1]?.id,
      phone_category_id: phoneCategories[2]?.id,
      phone_model: 'Samsung Galaxy S24 Ultra',
      phone_color: 'Titanium Violet',
      phone_storage: '1TB',
      customer_name: 'Shahzod Rashidov',
      phone_number: '+998901234577',
      initial_problem_description: 'Telefon qizib ketmoqda va sekin ishlayapti',
      source_type: 'Bot',
      priority: 'Medium',
      estimated_cost: 280000,
      estimated_completion_time: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      pickup_method: 'Pickup',
      delivery_method: 'Pickup',
    },
    {
      id: 'b0000000-0000-0000-0000-000000000012',
      order_number: 'RO-2025-012',
      user_id: users[1]?.id,
      branch_id: branches[0]?.id,
      phone_category_id: phoneCategories[3]?.id,
      phone_model: 'Samsung Galaxy A54',
      phone_color: 'Awesome Graphite',
      phone_storage: '256GB',
      customer_name: 'Nilufar Saidova',
      phone_number: '+998901234578',
      initial_problem_description: 'Telefon tushib ketgan, orqa qismi sinib ketgan',
      source_type: 'App',
      priority: 'Low',
      estimated_cost: 180000,
      estimated_completion_time: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      pickup_method: 'Self',
      delivery_method: 'Self',
    },
    {
      id: 'b0000000-0000-0000-0000-000000000013',
      order_number: 'RO-2025-013',
      user_id: users[2]?.id,
      branch_id: branches[1]?.id,
      phone_category_id: phoneCategories[4]?.id,
      phone_model: 'Xiaomi Mi 14 Ultra',
      phone_color: 'White',
      phone_storage: '512GB',
      customer_name: 'Temur Alimov',
      phone_number: '+998901234579',
      initial_problem_description: 'Kamera linzasi yorug\'likka sezgir emas, qorong\'u rasmlar',
      source_type: 'Organic',
      priority: 'High',
      estimated_cost: 420000,
      estimated_completion_time: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      pickup_method: 'Pickup',
      delivery_method: 'Delivery',
    },
    {
      id: 'b0000000-0000-0000-0000-000000000014',
      order_number: 'RO-2025-014',
      user_id: users[3]?.id,
      branch_id: branches[0]?.id,
      phone_category_id: phoneCategories[5]?.id,
      phone_model: 'Xiaomi Redmi Note 13 Pro',
      phone_color: 'Midnight Black',
      phone_storage: '128GB',
      customer_name: 'Zarina Normatova',
      phone_number: '+998901234580',
      initial_problem_description: 'Telefonni qo\'ng\'iroq qilishda eshitilmayapti, ovoz chiqmayapti',
      source_type: 'Web',
      priority: 'High',
      estimated_cost: 200000,
      estimated_completion_time: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      pickup_method: 'Self',
      delivery_method: 'Self',
    },
    {
      id: 'b0000000-0000-0000-0000-000000000015',
      order_number: 'RO-2025-015',
      user_id: users[4]?.id,
      branch_id: branches[1]?.id,
      phone_category_id: phoneCategories[6]?.id,
      phone_model: 'POCO X6 Pro',
      phone_color: 'Yellow',
      phone_storage: '256GB',
      customer_name: 'Gulchehra Nazarov',
      phone_number: '+998901234581',
      initial_problem_description: 'Telefonni qayta ishga tushirish kerak, ilovalar to\'xtayapti',
      source_type: 'App',
      priority: 'Low',
      estimated_cost: 100000,
      estimated_completion_time: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      pickup_method: 'Pickup',
      delivery_method: 'Pickup',
    },
  ];

  for (const order of sampleOrders) {
    const statusId = branchStatuses[order.branch_id];
    if (!statusId) continue;

    await knex('repair_orders').insert({
      id: order.id,
      order_number: order.order_number,
      user_id: order.user_id,
      branch_id: order.branch_id,
      current_status_id: statusId,
      phone_category_id: order.phone_category_id,
      phone_model: order.phone_model,
      phone_color: order.phone_color,
      phone_storage: order.phone_storage,
      customer_name: order.customer_name,
      phone_number: order.phone_number,
      initial_problem_description: order.initial_problem_description,
      source_type: order.source_type,
      priority: order.priority,
      estimated_cost: order.estimated_cost,
      estimated_completion_time: order.estimated_completion_time,
      pickup_method: order.pickup_method,
      delivery_method: order.delivery_method,
      is_active: true,
      status: 'Open',
      created_by: admins[0]?.id || '00000000-0000-0000-0000-000000000001',
      created_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Random time in last week
      updated_at: knex.fn.now(),
    });
  }
};