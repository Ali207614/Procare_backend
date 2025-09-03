exports.seed = async function (knex) {
  await knex('role_permissions').del();
  await knex('roles').del();

  // 1️⃣ Super Admin role yaratamiz
  const roles = [
    {
      id: '00000000-0000-0000-0000-000000000000',
      name: 'Super Admin',
      is_active: true,
      is_protected: false,
      status: 'Open',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: '00000000-0000-4000-8000-000000000000',
      name: 'Courier',
      is_active: true,
      is_protected: true,
      status: 'Open',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
  ];

  await knex('roles').insert(roles);

  const allPermissions = await knex('permissions').select('id');

  const rolePermissions = allPermissions.map((permission) => ({
    role_id: roles[0].id,
    permission_id: permission.id,
  }));

  await knex('role_permissions').insert(rolePermissions);
};
