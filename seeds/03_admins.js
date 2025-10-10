const { v4: uuidv4 } = require('uuid');

exports.seed = async function (knex) {
  await knex('admin_roles').del();
  await knex('campaigns').del();
  await knex('templates').del();
  await knex('admins').del();

  const superAdminId = '00000000-0000-0000-0000-000000000000';
  const superAdminRoleId = '00000000-0000-0000-0000-000000000000';

  const superAdmin = {
    id: superAdminId,
    first_name: 'Super',
    last_name: 'Admin',
    is_protected: true, // SuperAdmin himoyalangan bo‘lishi kerak
    phone_number: '+998903367448',
    phone_verified: true,
    password: '$2a$10$EHzpy4lcLj0mZ/pkji./5uyz8f.WFoXiCd9DXdrXMt3rV5GF8KNzK', // 1111
    passport_series: 'AA1234567',
    birth_date: new Date('1990-01-01'),
    hire_date: new Date('2020-01-01'),
    id_card_number: '1234567890',
    language: 'uz',
    is_active: true,
    status: 'Open',
    created_at: knex.fn.now(),
    updated_at: knex.fn.now(),
  };

  const admins = [superAdmin];

  for (let i = 1; i <= 19; i++) {
    admins.push({
      id: uuidv4(),
      first_name: `Admin${i}`,
      last_name: `User${i}`,
      is_protected: false,
      phone_number: `+9989012345${String(i).padStart(2, '0')}`,
      phone_verified: true,
      password: '$2a$10$EHzpy4lcLj0mZ/pkji./5uyz8f.WFoXiCdN1aK',
      passport_series: `AB${1000000 + i}`,
      birth_date: new Date(`1990-01-${String((i % 28) + 1).padStart(2, '0')}`),
      hire_date: new Date(`2021-01-${String((i % 28) + 1).padStart(2, '0')}`),
      id_card_number: `${9000000000 + i}`,
      language: i % 2 === 0 ? 'uz' : 'ru',
      is_active: true,
      status: 'Open',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    });
  }

  await knex('admins').insert(admins);

  await knex('admin_roles').insert({
    admin_id: superAdminId,
    role_id: superAdminRoleId,
  });
};
