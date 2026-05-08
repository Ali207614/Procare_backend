const LIST_PERMISSION_ID = '00000000-0000-4000-8000-000000000004';
const DETAIL_PERMISSION_ID = '00000000-0000-4000-8000-000000000095';

const OLD_LIST_PERMISSION_NAME = 'admin.manage.view';
const NEW_LIST_PERMISSION_NAME = 'admin.manage.view_all';
const DETAIL_PERMISSION_NAME = 'admin.manage.view_details';

exports.up = async function (knex) {
  const now = knex.fn.now();

  const listPermission = {
    id: LIST_PERMISSION_ID,
    name: NEW_LIST_PERMISSION_NAME,
    description: "Adminlar ro'yxatini ko'rish",
    is_active: true,
    status: 'Open',
    created_at: now,
    updated_at: now,
  };

  const detailPermission = {
    id: DETAIL_PERMISSION_ID,
    name: DETAIL_PERMISSION_NAME,
    description: "Admin tafsilotlarini ko'rish",
    is_active: true,
    status: 'Open',
    created_at: now,
    updated_at: now,
  };

  await knex('permissions')
    .insert(listPermission)
    .onConflict('id')
    .merge({
      name: listPermission.name,
      description: listPermission.description,
      is_active: true,
      status: 'Open',
      updated_at: now,
    });

  await knex('permissions')
    .insert(detailPermission)
    .onConflict('id')
    .merge({
      name: detailPermission.name,
      description: detailPermission.description,
      is_active: true,
      status: 'Open',
      updated_at: now,
    });

  const rolesWithAdminListAccess = await knex('role_permissions')
    .where('permission_id', LIST_PERMISSION_ID)
    .select('role_id');

  if (rolesWithAdminListAccess.length > 0) {
    await knex('role_permissions')
      .insert(
        rolesWithAdminListAccess.map(({ role_id }) => ({
          role_id,
          permission_id: DETAIL_PERMISSION_ID,
        })),
      )
      .onConflict(['role_id', 'permission_id'])
      .ignore();
  }
};

exports.down = async function (knex) {
  await knex('role_permissions').where({ permission_id: DETAIL_PERMISSION_ID }).delete();
  await knex('permissions').where({ id: DETAIL_PERMISSION_ID }).delete();

  await knex('permissions').where({ id: LIST_PERMISSION_ID }).update({
    name: OLD_LIST_PERMISSION_NAME,
    description: "Adminlarni ko'rish",
    updated_at: knex.fn.now(),
  });
};
