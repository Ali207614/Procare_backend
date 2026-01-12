exports.seed = async function (knex) {
  await knex('repair_order_status_permissions').del();

  // Get all repair order status transitions
  const transitions = await knex('repair_order_status_transitions')
    .select('id', 'from_status_id', 'to_status_id')
    .where('status', 'Open');

  // Get all roles
  const roles = await knex('roles').select('id', 'name').where('status', 'Open');

  let permissionId = 1;

  for (const transition of transitions) {
    for (const role of roles) {
      // Determine if this role should have permission for this transition
      let hasPermission = false;

      // Get status details to determine permissions
      const fromStatus = await knex('repair_order_statuses')
        .select('sort', 'type', 'name_en')
        .where('id', transition.from_status_id)
        .first();

      const toStatus = await knex('repair_order_statuses')
        .select('sort', 'type', 'name_en')
        .where('id', transition.to_status_id)
        .first();

      // Permission logic based on role
      switch (role.name) {
        case 'super_admin':
          hasPermission = true; // Super admin can do everything
          break;

        case 'admin':
          hasPermission = true; // Regular admin can do most things
          break;

        case 'manager':
          hasPermission = true; // Manager can do most things
          break;

        case 'technician':
          // Technicians can handle repair workflow but not final completion
          if (toStatus.type === 'Completed') {
            hasPermission = false; // Only managers/admins can complete orders
          } else if (toStatus.type === 'Cancelled') {
            hasPermission = false; // Only managers/admins can cancel
          } else {
            hasPermission = true;
          }
          break;

        case 'receptionist':
          // Receptionists can handle initial stages and customer communication
          if (fromStatus.sort <= 3 || toStatus.sort <= 3) { // New Order, Diagnosis, Waiting for Approval
            hasPermission = true;
          } else if (toStatus.type === 'Cancelled') {
            hasPermission = true; // Can cancel orders
          } else if (fromStatus.sort === 7 && toStatus.sort === 9) { // Ready to Completed
            hasPermission = true; // Can mark as completed when customer picks up
          } else {
            hasPermission = false;
          }
          break;

        case 'courier':
          // Couriers can only handle delivery-related transitions
          if ((fromStatus.sort === 8 && toStatus.sort === 9) || // Out for Delivery to Completed
              (fromStatus.sort === 7 && toStatus.sort === 8) || // Ready to Out for Delivery
              (fromStatus.sort === 8 && toStatus.sort === 7)) { // Out for Delivery back to Ready
            hasPermission = true;
          } else {
            hasPermission = false;
          }
          break;

        default:
          hasPermission = false;
      }

      if (hasPermission) {
        await knex('repair_order_status_permissions').insert({
          id: `70000000-0000-0000-0000-${String(permissionId).padStart(12, '0')}`,
          transition_id: transition.id,
          role_id: role.id,
          is_active: true,
          status: 'Open',
          created_by: '00000000-0000-0000-0000-000000000001', // Super admin
          created_at: knex.fn.now(),
          updated_at: knex.fn.now(),
        });
        permissionId++;
      }
    }
  }
};