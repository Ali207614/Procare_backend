exports.seed = async function (knex) {
  await knex('admin_roles').del();
  await knex('admins').del();

  // 1️⃣ Super admin yaratamiz
  const superAdmin = {
    id: '00000000-0000-0000-0000-000000000000',
    first_name: 'Super',
    last_name: 'Admin',
    is_protected: true,
    phone_number: '+998903367448',
    phone_verified: true,
    password: '$2a$10$EHzpy4lcLj0mZ/pkji./5uyz8f.WFoXiCd9DXdrXMt3rV5GF8KNzK', // 1111
    passport_series: 'AA1234567',
    birth_date: '1990-01-01',
    hire_date: '2020-01-01',
    id_card_number: '1234567890',
    language: 'uz',
    is_active: true,
    status: 'Open',
    created_at: knex.fn.now(),
    updated_at: knex.fn.now(),
  };

  await knex('admins').insert(superAdmin);

  // 2️⃣ Rolega bog‘lash uchun role id olamiz (Super Admin role id ni bilamiz)
  const superAdminRoleId = '00000000-0000-0000-0000-999999999999';

  await knex('admin_roles').insert({
    admin_id: superAdmin.id,
    role_id: superAdminRoleId,
  });
};
