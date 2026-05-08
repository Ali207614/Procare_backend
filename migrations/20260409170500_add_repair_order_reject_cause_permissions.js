/**
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
exports.up = async function (knex) {
  const permissions = [
    {
      id: '00000000-0000-4000-8000-000000000087',
      name: 'repair.order.reject.cause.view',
      description: 'Reject sabablarini korish huquqi',
    },
    {
      id: '00000000-0000-4000-8000-000000000088',
      name: 'repair.order.reject.cause.create',
      description: 'Reject sababini yaratish huquqi',
    },
    {
      id: '00000000-0000-4000-8000-000000000089',
      name: 'repair.order.reject.cause.update',
      description: 'Reject sababini tahrirlash huquqi',
    },
    {
      id: '00000000-0000-4000-8000-000000000090',
      name: 'repair.order.reject.cause.delete',
      description: 'Reject sababini ochirish huquqi',
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

  const superAdminRole = await knex('roles')
    .select('id')
    .where({ id: '00000000-0000-4000-8000-000000000000' })
    .orWhere({ name: 'Super Admin' })
    .first();
  const persistedPermissions = await knex('permissions')
    .select('id', 'name')
    .whereIn(
      'name',
      permissions.map((permission) => permission.name),
    );

  if (!superAdminRole) {
    return;
  }

  for (const permission of persistedPermissions) {
    await knex('role_permissions')
      .insert({
        role_id: superAdminRole.id,
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
    '00000000-0000-4000-8000-000000000087',
    '00000000-0000-4000-8000-000000000088',
    '00000000-0000-4000-8000-000000000089',
    '00000000-0000-4000-8000-000000000090',
  ];

  await knex('role_permissions').whereIn('permission_id', permissionIds).delete();
  await knex('permissions').whereIn('id', permissionIds).delete();
};
