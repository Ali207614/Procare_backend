exports.seed = async function (knex) {
  // avval mavjudlarni o'chirib tashlaymiz
  await knex('phone_os_types').del();

  // yangi tizimlar qo'shamiz
  await knex('phone_os_types').insert([
    {
      id: knex.raw('gen_random_uuid()'),
      name_uz: 'iOS',
      name_ru: 'iOS',
      name_en: 'iOS',
      sort: 1,
      is_active: true,
      status: 'Open',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: knex.raw('gen_random_uuid()'),
      name_uz: 'Android',
      name_ru: 'Андроид',
      name_en: 'Android',
      sort: 2,
      is_active: true,
      status: 'Open',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
  ]);
};
