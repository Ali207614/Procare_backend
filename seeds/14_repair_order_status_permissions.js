exports.seed = async function (knex) {
  await knex('repair_order_status_permissions').del();

  const superAdminRoleId = '00000000-0000-4000-8000-000000000000';

  // Get all active statuses grouped by branch
  const statuses = await knex('repair_order_statuses')
    .select('id', 'branch_id', 'sort')
    .where('status', 'Open')
    .orderBy(['branch_id', 'sort']);

  let permissionIndex = 1;

  for (const status of statuses) {
    // Only the first status (sort=1, "New Order") gets can_create_user enabled
    const isNewOrder = status.sort === 1;

    await knex('repair_order_status_permissions').insert({
      id: `70000000-0000-0000-0000-${String(permissionIndex).padStart(12, '0')}`,
      branch_id: status.branch_id,
      status_id: status.id,
      role_id: superAdminRoleId,
      can_add: true,
      can_view: true,
      can_update: true,
      can_delete: true,
      can_payment_add: true,
      can_payment_cancel: true,
      can_assign_admin: true,
      can_notification: true,
      can_notification_bot: true,
      can_change_active: true,
      can_change_status: true,
      can_view_initial_problems: true,
      can_change_initial_problems: true,
      can_view_final_problems: true,
      can_change_final_problems: true,
      can_comment: true,
      can_pickup_manage: true,
      can_delivery_manage: true,
      can_view_payments: true,
      can_manage_rental_phone: true,
      can_view_history: true,
      can_user_manage: true,
      can_create_user: isNewOrder,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    });

    permissionIndex++;
  }
};
