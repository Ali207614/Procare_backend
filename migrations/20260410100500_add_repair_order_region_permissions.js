/**
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.up = async function (knex) {
  const permissions = [
    {
      id: '00000000-0000-4000-8000-000000000091',
      name: 'repair.order.region.view',
      description: 'Repair order hududlarini korish huquqi',
    },
    {
      id: '00000000-0000-4000-8000-000000000092',
      name: 'repair.order.region.create',
      description: 'Repair order hududini yaratish huquqi',
    },
    {
      id: '00000000-0000-4000-8000-000000000093',
      name: 'repair.order.region.update',
      description: 'Repair order hududini tahrirlash huquqi',
    },
    {
      id: '00000000-0000-4000-8000-000000000094',
      name: 'repair.order.region.delete',
      description: 'Repair order hududini ochirish huquqi',
    },
  ];

  for (const permission of permissions) {
    await knex('permissions')
      .insert({
        ...permission,
        is_active: true,
        status: 'Open',
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
      })
      .onConflict('name')
      .ignore();
  }

  const superAdminRoleId = '00000000-0000-4000-8000-000000000000';
  const persistedPermissions = await knex('permissions')
    .select('id', 'name')
    .whereIn(
      'name',
      permissions.map((permission) => permission.name),
    );

  for (const permission of persistedPermissions) {
    await knex('role_permissions')
      .insert({
        role_id: superAdminRoleId,
        permission_id: permission.id,
      })
      .onConflict(['role_id', 'permission_id'])
      .ignore();
  }
};

/**
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.down = async function (knex) {
  const permissionIds = [
    '00000000-0000-4000-8000-000000000091',
    '00000000-0000-4000-8000-000000000092',
    '00000000-0000-4000-8000-000000000093',
    '00000000-0000-4000-8000-000000000094',
  ];

  await knex('role_permissions').whereIn('permission_id', permissionIds).delete();
  await knex('permissions').whereIn('id', permissionIds).delete();
};
