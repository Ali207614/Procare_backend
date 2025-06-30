exports.seed = async function (knex) {
  const NO_BRANCH_ID = '00000000-0000-0000-0000-000000000000';
  const superAdminId = '00000000-0000-0000-0000-000000000000';

  await knex('branches').del();

  await knex('branches').insert({
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
    can_user_view: false,
    sort: 1,

    created_by: superAdminId,
    created_at: knex.fn.now(),
    updated_at: knex.fn.now(),
  });
};
