const { v4: uuidv4 } = require('uuid');

exports.seed = async function (knex) {
  const NO_BRANCH_ID = '00000000-0000-0000-0000-000000000000';
  const superAdminId = '00000000-0000-0000-0000-000000000000';

  await knex('branches').del();

  const branches = [
    {
      id: NO_BRANCH_ID,
      name_uz: 'Texnik filial',
      name_ru: 'Технический филиал',
      name_en: 'Technical Branch',
      address_uz: 'Aniqlanmagan',
      address_ru: 'Не указано',
      address_en: 'Unknown',
      lat: null,
      long: null,
      support_phone: null,
      work_start_time: null,
      work_end_time: null,
      bg_color: '#cccccc',
      color: '#000000',
      status: 'Open',
      is_active: true,
      is_protected: true,
      created_by: superAdminId,
      sort: 1,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    ...Array.from({ length: 19 }).map((_, i) => ({
      id: uuidv4(),
      name_uz: `Filial ${i + 1}`,
      name_ru: `Филиал ${i + 1}`,
      name_en: `Branch ${i + 1}`,
      address_uz: `Manzil ${i + 1}`,
      address_ru: `Адрес ${i + 1}`,
      address_en: `Address ${i + 1}`,
      lat: null,
      long: null,
      support_phone: null,
      work_start_time: null,
      work_end_time: null,
      bg_color: '#cccccc',
      color: '#000000',
      status: 'Open',
      is_active: true,
      is_protected: false,
      created_by: superAdminId,
      sort: i + 2,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    })),
  ];

  await knex('branches').insert(branches);
};
