const ANALYTICS_PERMISSIONS = [
  {
    id: '00000000-0000-4000-8000-000000000096',
    name: 'analytics.repair_orders.view',
    description: 'Repair order analytics view',
  },
  {
    id: '00000000-0000-4000-8000-000000000097',
    name: 'analytics.repair_orders.view_all',
    description: 'Repair order analytics across all branches',
  },
];

exports.up = async function (knex) {
  for (const permission of ANALYTICS_PERMISSIONS) {
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
    for (const permission of ANALYTICS_PERMISSIONS) {
      await knex('role_permissions')
        .insert({
          role_id: role.id,
          permission_id: permission.id,
        })
        .onConflict(['role_id', 'permission_id'])
        .ignore();
    }
  }

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS repair_orders_analytics_created_idx
    ON repair_orders (branch_id, created_at)
    WHERE status <> 'Deleted';
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS repair_orders_analytics_updated_idx
    ON repair_orders (branch_id, updated_at)
    WHERE status <> 'Deleted';
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS repair_orders_analytics_status_idx
    ON repair_orders (branch_id, status_id)
    WHERE status <> 'Deleted';
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS repair_orders_analytics_source_idx
    ON repair_orders (source)
    WHERE status <> 'Deleted';
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS repair_orders_analytics_reject_cause_idx
    ON repair_orders (reject_cause_id)
    WHERE status <> 'Deleted';
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS repair_order_histories_status_transition_idx
    ON repair_order_change_histories (created_at, repair_order_id)
    WHERE field = 'status_id';
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS repair_order_histories_status_new_value_idx
    ON repair_order_change_histories ((new_value #>> '{}'))
    WHERE field = 'status_id';
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS repair_order_assign_admins_order_created_idx
    ON repair_order_assign_admins (repair_order_id, created_at DESC);
  `);
};

exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS repair_order_assign_admins_order_created_idx;');
  await knex.raw('DROP INDEX IF EXISTS repair_order_histories_status_new_value_idx;');
  await knex.raw('DROP INDEX IF EXISTS repair_order_histories_status_transition_idx;');
  await knex.raw('DROP INDEX IF EXISTS repair_orders_analytics_reject_cause_idx;');
  await knex.raw('DROP INDEX IF EXISTS repair_orders_analytics_source_idx;');
  await knex.raw('DROP INDEX IF EXISTS repair_orders_analytics_status_idx;');
  await knex.raw('DROP INDEX IF EXISTS repair_orders_analytics_updated_idx;');
  await knex.raw('DROP INDEX IF EXISTS repair_orders_analytics_created_idx;');

  const permissionIds = ANALYTICS_PERMISSIONS.map((permission) => permission.id);
  await knex('role_permissions').whereIn('permission_id', permissionIds).delete();
  await knex('permissions').whereIn('id', permissionIds).delete();
};
