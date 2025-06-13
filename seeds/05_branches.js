
export async function seed(knex) {
  const NO_BRANCH_ID = '00000000-0000-0000-0000-000000000000';
  const superAdminRoleId = '00000000-0000-0000-0000-999999999999';

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
    sort: 0,

    created_by: superAdminRoleId,
    created_at: knex.fn.now(),
    updated_at: knex.fn.now(),
  });
}
