const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

exports.seed = async function (knex) {
  await knex('users').del();

  const users = [];
  const password = await bcrypt.hash('password123', 10);

  // Realistic Uzbek first names
  const firstNames = [
    'Akmal', 'Malika', 'Bobur', 'Nigora', 'Sardor', 'Feruza', 'Jasur', 'Dilnoza',
    'Aziz', 'Madina', 'Rustam', 'Gulnora', 'Shahzod', 'Nilufar', 'Temur', 'Zarina',
    'Farhod', 'Sevara', 'Bekzod', 'Kamola', 'Javohir', 'Dilshoda', 'Olim', 'Gulruh',
    'Bahodir', 'Maftuna', 'Sherzod', 'Maftuna', 'Ulugbek', 'Shahnoza', 'Davron', 'Nigina',
    'Ravshan', 'Gulchehra', 'Ilyos', 'Mukhlisa', 'Shukrullo', 'Dilbar', 'Asadbek', 'Maftuna',
    'Jahongir', 'Gulbahor', 'Nodir', 'Maftuna', 'Shavkat', 'Gulnaz', 'Fazliddin', 'Maftuna',
    'Islom', 'Gulnoz', 'Rustam', 'Maftuna', 'Shohruh', 'Gulchehra', 'Tohir', 'Maftuna',
    'Akbar', 'Gulshan', 'Rustam', 'Maftuna', 'Shavkat', 'Gulnaz', 'Fazliddin', 'Maftuna',
    'Islom', 'Gulnoz', 'Rustam', 'Maftuna', 'Shohruh', 'Gulchehra', 'Tohir', 'Maftuna',
    'Akbar', 'Gulshan', 'Rustam', 'Maftuna', 'Shavkat', 'Gulnaz', 'Fazliddin', 'Maftuna',
    'Islom', 'Gulnoz', 'Rustam', 'Maftuna', 'Shohruh', 'Gulchehra', 'Tohir', 'Maftuna',
  ];

  // Realistic Uzbek last names
  const lastNames = [
    'Karimov', 'Toshmatova', 'Rashidov', 'Saidova', 'Alimov', 'Normatova', 'Nazarov', 'Yusupova',
    'Toshmatov', 'Karimova', 'Rashidova', 'Saidov', 'Alimova', 'Normatov', 'Nazarova', 'Yusupov',
    'Abdullayev', 'Rahimova', 'Ismoilov', 'Xasanova', 'Yuldashev', 'Turgunova', 'Murodov', 'Qodirova',
    'Valiyev', 'Rustamova', 'Fayzullayev', 'Sobirova', 'Tojiboyev', 'Mahmudova', 'Qosimov', 'Rahimova',
    'Abdullayev', 'Rahimova', 'Ismoilov', 'Xasanova', 'Yuldashev', 'Turgunova', 'Murodov', 'Qodirova',
    'Valiyev', 'Rustamova', 'Fayzullayev', 'Sobirova', 'Tojiboyev', 'Mahmudova', 'Qosimov', 'Rahimova',
    'Abdullayev', 'Rahimova', 'Ismoilov', 'Xasanova', 'Yuldashev', 'Turgunova', 'Murodov', 'Qodirova',
    'Valiyev', 'Rustamova', 'Fayzullayev', 'Sobirova', 'Tojiboyev', 'Mahmudova', 'Qosimov', 'Rahimova',
    'Abdullayev', 'Rahimova', 'Ismoilov', 'Xasanova', 'Yuldashev', 'Turgunova', 'Murodov', 'Qodirova',
    'Valiyev', 'Rustamova', 'Fayzullayev', 'Sobirova', 'Tojiboyev', 'Mahmudova', 'Qosimov', 'Rahimova',
  ];

  for (let i = 1; i <= 100; i++) {
    // Generate realistic phone numbers (Uzbekistan format: +998 XX XXX XX XX)
    const operator = i % 3 === 0 ? '90' : i % 3 === 1 ? '91' : '93';
    const phone1 = `+998${operator}${String(1000000 + i).slice(-7)}`;
    const phone2 = i % 2 === 0 ? `+998${operator}${String(2000000 + i).slice(-7)}` : null;

    // Generate customer code (format: CUST-XXXXX)
    const customerCode = `CUST-${String(10000 + i).padStart(5, '0')}`;

    users.push({
      id: uuidv4(),
      customer_code: customerCode,
      first_name: firstNames[(i - 1) % firstNames.length],
      last_name: lastNames[(i - 1) % lastNames.length],
      phone_number1: phone1,
      phone_number2: phone2,
      phone_verified: i % 3 === 0, // Every 3rd user is verified
      verification_code: String(1000 + i),
      password,

      passport_series: `AB${String(1000000 + i).slice(-7)}`,
      birth_date: new Date(1985 + (i % 30), (i % 12), (i % 28) + 1),
      id_card_number: `${String(3000000000 + i).slice(-10)}`,
      language: i % 2 === 0 ? 'uz' : 'ru',

      telegram_chat_id: i % 5 === 0 ? process.env.PERSONAL_CHAT_ID : null,
      telegram_username: i % 5 === 0 ? `user_${i}` : null,

      source: i % 3 === 0 ? 'telegram_bot' : i % 3 === 1 ? 'app' : 'web',
      created_by: null,

      is_active: true,
      status: 'Open',

      created_at: new Date(Date.now() - i * 60000),
      updated_at: new Date(),
    });
  }

  await knex('users').insert(users);
};
