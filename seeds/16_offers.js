const { v4: uuidv4 } = require('uuid');

exports.seed = async function (knex) {
  await knex('offers').del();

  const offers = [
    {
      id: uuidv4(),
      content_uz: 'Ushbu ommaviy ofera qoidalari foydalanuvchilar uchun mo\'ljallangan...',
      content_ru: 'Настоящие правила публичной оферты предназначены для пользователей...',
      content_en: 'These public offer rules are intended for users...',
      version: 'v1.0.0',
      is_active: false,
      status: 'Open',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: uuidv4(),
      content_uz: 'Ushbu qoidalar yangilangan ommaviy ofera shartlaridir...',
      content_ru: 'Эти правила являются обновленными условиями публичной оферты...',
      content_en: 'These rules are the updated terms of the public offer...',
      version: 'v1.1.0',
      is_active: true, // The actively used version
      status: 'Open',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    }
  ];

  await knex('offers').insert(offers);
};
