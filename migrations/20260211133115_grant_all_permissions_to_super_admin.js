exports.up = async function (knex) {
  const SUPER_ADMIN_ROLE_ID = '00000000-0000-4000-8000-000000000000';

  // Get all permission IDs
  const permissions = await knex('permissions').select('id');

  if (permissions.length === 0) return;

  // Prepare role_permissions entries for Super Admin
  const rolePermissions = permissions.map((p) => ({
    role_id: SUPER_ADMIN_ROLE_ID,
    permission_id: p.id,
  }));

  // Use onConflict to avoid duplicates if some permissions were already assigned
  await knex('role_permissions')
    .insert(rolePermissions)
    .onConflict(['role_id', 'permission_id'])
    .ignore();
};

exports.down = async function (knex) {
  // We don't necessarily want to remove all permissions on rollback, 
  // as some might have been there before. But if we must:
  // const SUPER_ADMIN_ROLE_ID = '00000000-0000-4000-8000-000000000000';
  // await knex('role_permissions').where('role_id', SUPER_ADMIN_ROLE_ID).del();
};
