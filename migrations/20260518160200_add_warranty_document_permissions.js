const WARRANTY_DOCUMENT_PERMISSIONS = [
  {
    id: '00000000-0000-4000-8000-000000000098',
    name: 'warranty_documents.view_all',
    description: "Kafolat hujjatlarini ko'rish",
  },
  {
    id: '00000000-0000-4000-8000-000000000099',
    name: 'warranty_documents.view',
    description: "Kafolat hujjatini ko'rish",
  },
  {
    id: '00000000-0000-4000-8000-000000000100',
    name: 'warranty_documents.create',
    description: 'Kafolat hujjati yaratish',
  },
  {
    id: '00000000-0000-4000-8000-000000000101',
    name: 'warranty_documents.update',
    description: 'Kafolat hujjatini tahrirlash',
  },
  {
    id: '00000000-0000-4000-8000-000000000102',
    name: 'warranty_documents.delete',
    description: "Kafolat hujjatini o'chirish",
  },
];

exports.up = async function (knex) {
  for (const permission of WARRANTY_DOCUMENT_PERMISSIONS) {
    await knex('permissions')
      .insert({
        ...permission,
        is_active: true,
        status: 'Open',
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
      })
      .onConflict('id')
      .merge({
        name: permission.name,
        description: permission.description,
        is_active: true,
        status: 'Open',
        updated_at: knex.fn.now(),
      });
  }

  const superAdminRoles = await knex('roles').where({ type: 'SuperAdmin', status: 'Open' });
  for (const role of superAdminRoles) {
    for (const permission of WARRANTY_DOCUMENT_PERMISSIONS) {
      await knex('role_permissions')
        .insert({
          role_id: role.id,
          permission_id: permission.id,
        })
        .onConflict(['role_id', 'permission_id'])
        .ignore();
    }
  }
};

exports.down = async function (knex) {
  const permissionIds = WARRANTY_DOCUMENT_PERMISSIONS.map((permission) => permission.id);
  await knex('role_permissions').whereIn('permission_id', permissionIds).delete();
  await knex('permissions').whereIn('id', permissionIds).delete();
};
