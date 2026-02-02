const { v4: uuidv4 } = require('uuid');

exports.seed = async function (knex) {
  await knex('admin_roles').del();
  await knex('campaigns').del();
  await knex('templates').del();
  await knex('admins').del();

  const superAdminId = '00000000-0000-0000-0000-000000000000';
  const superAdmin2Id = '00000000-0000-0000-0000-000000000001';
  const superAdminRoleId = '00000000-0000-0000-0000-000000000000';

  const superAdmin = {
    id: superAdminId,
    first_name: 'Super',
    last_name: 'Admin',
    is_protected: true,
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

  const superAdmin2 = {
    id: superAdmin2Id,
    first_name: 'Shohabbos',
    last_name: 'Urinov',
    is_protected: true,
    phone_number: '+998974556162',
    phone_verified: true,
    password: '$2a$10$EHzpy4lcLj0mZ/pkji./5uyz8f.WFoXiCd9DXdrXMt3rV5GF8KNzK', // 1111
    passport_series: 'AA7654321',
    birth_date: new Date('1995-01-01'),
    hire_date: new Date('2024-01-01'),
    id_card_number: '9876543210',
    language: 'uz',
    is_active: true,
    status: 'Open',
    created_at: knex.fn.now(),
    updated_at: knex.fn.now(),
  };

  // Realistic admin names
  const adminFirstNames = [
    'Akmal', 'Malika', 'Bobur', 'Nigora', 'Sardor', 'Feruza', 'Jasur', 'Dilnoza',
    'Aziz', 'Madina', 'Rustam', 'Gulnora', 'Shahzod', 'Nilufar', 'Temur', 'Zarina',
    'Farhod', 'Sevara', 'Bekzod', 'Kamola',
  ];
  
  const adminLastNames = [
    'Karimov', 'Toshmatova', 'Rashidov', 'Saidova', 'Alimov', 'Normatova', 'Nazarov', 'Yusupova',
    'Toshmatov', 'Karimova', 'Rashidova', 'Saidov', 'Alimova', 'Normatov', 'Nazarova', 'Yusupov',
    'Abdullayev', 'Rahimova', 'Ismoilov', 'Xasanova',
  ];

  const admins = [superAdmin, superAdmin2];

  for (let i = 1; i <= 19; i++) {
    admins.push({
      id: uuidv4(),
      first_name: adminFirstNames[(i - 1) % adminFirstNames.length],
      last_name: adminLastNames[(i - 1) % adminLastNames.length],
      is_protected: false,
      phone_number: `+99890${String(1234567 + i).slice(-7)}`,
      phone_verified: true,
      password: '$2a$10$EHzpy4lcLj0mZ/pkji./5uyz8f.WFoXiCd9DXdrXMt3rV5GF8KNzK', // 1111
      passport_series: `AB${String(1000000 + i).slice(-7)}`,
      birth_date: new Date(1985 + (i % 15), (i % 12), (i % 28) + 1),
      hire_date: new Date(2020 + (i % 4), (i % 12), (i % 28) + 1),
      id_card_number: `${String(3000000000 + i).slice(-10)}`,
      language: i % 2 === 0 ? 'uz' : 'ru',
      is_active: true,
      status: 'Open',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    });
  }

  await knex('admins').insert(admins);

  await knex('admin_roles').insert([
    { admin_id: superAdminId, role_id: superAdminRoleId },
    { admin_id: superAdmin2Id, role_id: superAdminRoleId },
  ]);
};
