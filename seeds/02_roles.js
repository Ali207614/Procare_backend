
exports.seed = async function (knex) {
  await knex('role_permissions').del();
  await knex('roles').del();

  // 1️⃣ Super Admin role yaratamiz
  const superAdminRole = {
    id: '00000000-0000-0000-0000-999999999999',
    name: 'Super Admin',
    is_active: true,
    status: 'Open',
    created_at: knex.fn.now(),
    updated_at: knex.fn.now(),
  };

  await knex('roles').insert(superAdminRole);

  const allPermissions = await knex('permissions').select('id');

  // 3️⃣ Barcha permissions ni super admin ga assign qilamiz
  const rolePermissions = allPermissions.map((permission) => ({
    role_id: superAdminRole.id,
    permission_id: permission.id,
  }));

  await knex('role_permissions').insert(rolePermissions);
};
