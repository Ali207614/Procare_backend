const { v4: uuidv4 } = require('uuid');

exports.seed = async function (knex) {
  // Deleting existing templates is already handled in 03_admins.js, 
  // but it's safer to ensure they are gone here as well if we run this independently.
  await knex('campaign_recipient').del();
  await knex('campaigns').del();
  await knex('template_histories').del();
  await knex('templates').del();

  const superAdminId = '00000000-0000-4000-8000-000000000000';

  const templates = [
    {
      id: uuidv4(),
      title: 'Xush kelibsiz (Uzbek)',
      language: 'uz',
      body: 'Assalomu alaykum {{first_name}}! ProCare xizmatiga xush kelibsiz. Bizni tanlaganingiz uchun tashakkur.',
      variables: JSON.stringify(['first_name']),
      status: 'Open',
      created_by: superAdminId,
      used_count: 0,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: uuidv4(),
      title: 'Servis markaziga taklif (Uzbek)',
      language: 'uz',
      body: 'Hurmatli {{first_name}} {{last_name}}, sizni ProCare servis markazimizda kutib qolamiz. Siz uchun maxsus chegirmalarimiz bor!',
      variables: JSON.stringify(['first_name', 'last_name']),
      status: 'Open',
      created_by: superAdminId,
      used_count: 5,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: uuidv4(),
      title: 'Акция на ремонт (Russian)',
      language: 'ru',
      body: 'Здравствуйте, {{first_name}}! Только на этой неделе скидка 20% на замену экрана в ProCare.',
      variables: JSON.stringify(['first_name']),
      status: 'Open',
      created_by: superAdminId,
      used_count: 10,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: uuidv4(),
      title: 'Обслуживание завершено (Russian)',
      language: 'ru',
      body: 'Уважаемый(ая) {{first_name}}, ваш заказ готов! Вы можете забрать свое устройство в любое удобное время.',
      variables: JSON.stringify(['first_name']),
      status: 'Open',
      created_by: superAdminId,
      used_count: 2,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: uuidv4(),
      title: 'Welcome Discount (English)',
      language: 'en',
      body: 'Hello {{first_name}}! Welcome to ProCare. Use code PRO20 for a 20% discount on your first repair.',
      variables: JSON.stringify(['first_name']),
      status: 'Open',
      created_by: superAdminId,
      used_count: 0,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: uuidv4(),
      title: 'Draft Template (Uzbek)',
      language: 'uz',
      body: 'Bu qoralama shablon. {{first_name}}',
      variables: JSON.stringify(['first_name']),
      status: 'Draft',
      created_by: superAdminId,
      used_count: 0,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
  ];

  await knex('templates').insert(templates);
};
