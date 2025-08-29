const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

exports.seed = async function (knex) {
  await knex('users').del();

  const users = [];
  const password = await bcrypt.hash('password123', 10);

  for (let i = 1; i <= 100; i++) {
    const prefix1 = i % 2 === 0 ? '99890' : '99891';
    const prefix2 = i % 2 === 0 ? '99893' : '99894';

    const phone1 = prefix1 + String(10000 + i).slice(-5);
    const phone2 = prefix2 + String(20000 + i).slice(-5);

    users.push({
      id: uuidv4(),
      sap_card_code: null,
      first_name: `FirstName${i}`,
      last_name: `LastName${i}`,
      phone_number1: phone1,
      phone_number2: phone2,
      phone_verified: false,
      verification_code: String(1000 + i),
      password,

      passport_series: `AB${100000 + i}`,
      birth_date: new Date(1990, 0, (i % 28) + 1),
      id_card_number: `ID${10000 + i}`,
      language: i % 2 === 0 ? 'uz' : 'ru',

      telegram_chat_id: null,
      telegram_username: null,

      source: i % 3 === 0 ? 'telegram_bot' : 'app',
      created_by: null,

      is_active: true,
      status: 'Open',

      created_at: new Date(),
      updated_at: new Date(),
    });
  }

  await knex('users').insert(users);
};
