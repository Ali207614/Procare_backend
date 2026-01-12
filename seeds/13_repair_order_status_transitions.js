exports.seed = async function (knex) {
  await knex('repair_order_status_transitions').del();

  // Get all repair order statuses to create transitions between them
  const statuses = await knex('repair_order_statuses')
    .select('id', 'sort', 'branch_id', 'type')
    .where('status', 'Open')
    .orderBy(['branch_id', 'sort']);

  // Group statuses by branch
  const statusesByBranch = statuses.reduce((acc, status) => {
    if (!acc[status.branch_id]) {
      acc[status.branch_id] = [];
    }
    acc[status.branch_id].push(status);
    return acc;
  }, {});

  let transitionId = 1;

  // Create transitions for each branch
  for (const [branchId, branchStatuses] of Object.entries(statusesByBranch)) {
    // Create forward transitions (normal workflow)
    for (let i = 0; i < branchStatuses.length - 1; i++) {
      const currentStatus = branchStatuses[i];
      const nextStatus = branchStatuses[i + 1];

      // Don't create transitions to/from completed or cancelled statuses
      if (currentStatus.type !== 'Completed' && currentStatus.type !== 'Cancelled' &&
          nextStatus.type !== 'Completed' && nextStatus.type !== 'Cancelled') {
        await knex('repair_order_status_transitions').insert({
          id: `60000000-0000-0000-0000-${String(transitionId).padStart(12, '0')}`,
          from_status_id: currentStatus.id,
          to_status_id: nextStatus.id,
          is_active: true,
          status: 'Open',
          created_by: '00000000-0000-0000-0000-000000000001', // Super admin
          created_at: knex.fn.now(),
          updated_at: knex.fn.now(),
        });
        transitionId++;
      }
    }

    // Create backward transitions (for going back in workflow)
    for (let i = 1; i < branchStatuses.length; i++) {
      const currentStatus = branchStatuses[i];
      const prevStatus = branchStatuses[i - 1];

      // Don't create transitions from completed or cancelled statuses
      if (currentStatus.type !== 'Completed' && currentStatus.type !== 'Cancelled' &&
          prevStatus.type !== 'Completed' && prevStatus.type !== 'Cancelled') {
        await knex('repair_order_status_transitions').insert({
          id: `60000000-0000-0000-0000-${String(transitionId).padStart(12, '0')}`,
          from_status_id: currentStatus.id,
          to_status_id: prevStatus.id,
          is_active: true,
          status: 'Open',
          created_by: '00000000-0000-0000-0000-000000000001', // Super admin
          created_at: knex.fn.now(),
          updated_at: knex.fn.now(),
        });
        transitionId++;
      }
    }

    // Create transitions to completion statuses from appropriate statuses
    const completionStatuses = branchStatuses.filter(s => s.type === 'Completed' || s.type === 'Cancelled');
    const workflowStatuses = branchStatuses.filter(s => !s.type || (s.type !== 'Completed' && s.type !== 'Cancelled'));

    for (const workflowStatus of workflowStatuses) {
      for (const completionStatus of completionStatuses) {
        // Allow transition to "Completed" only from "Ready" or "Out for Delivery"
        if (completionStatus.type === 'Completed' &&
            (workflowStatus.sort === 7 || workflowStatus.sort === 8)) { // Ready or Out for Delivery
          await knex('repair_order_status_transitions').insert({
            id: `60000000-0000-0000-0000-${String(transitionId).padStart(12, '0')}`,
            from_status_id: workflowStatus.id,
            to_status_id: completionStatus.id,
            is_active: true,
            status: 'Open',
            created_by: '00000000-0000-0000-0000-000000000001', // Super admin
            created_at: knex.fn.now(),
            updated_at: knex.fn.now(),
          });
          transitionId++;
        }

        // Allow transition to "Cancelled" from any workflow status
        if (completionStatus.type === 'Cancelled') {
          await knex('repair_order_status_transitions').insert({
            id: `60000000-0000-0000-0000-${String(transitionId).padStart(12, '0')}`,
            from_status_id: workflowStatus.id,
            to_status_id: completionStatus.id,
            is_active: true,
            status: 'Open',
            created_by: '00000000-0000-0000-0000-000000000001', // Super admin
            created_at: knex.fn.now(),
            updated_at: knex.fn.now(),
          });
          transitionId++;
        }
      }
    }

    // Special transitions for "Customer Not Responding" and "Cannot be Repaired"
    const specialStatuses = branchStatuses.filter(s => s.sort === 11 || s.sort === 12); // Customer not responding, Cannot be repaired

    for (const specialStatus of specialStatuses) {
      // Can transition from these special statuses to cancellation
      const cancelledStatus = branchStatuses.find(s => s.type === 'Cancelled');
      if (cancelledStatus) {
        await knex('repair_order_status_transitions').insert({
          id: `60000000-0000-0000-0000-${String(transitionId).padStart(12, '0')}`,
          from_status_id: specialStatus.id,
          to_status_id: cancelledStatus.id,
          is_active: true,
          status: 'Open',
          created_by: '00000000-0000-0000-0000-000000000001', // Super admin
          created_at: knex.fn.now(),
          updated_at: knex.fn.now(),
        });
        transitionId++;
      }

      // Can transition to these special statuses from most workflow statuses
      for (const workflowStatus of workflowStatuses) {
        if (workflowStatus.id !== specialStatus.id && workflowStatus.sort <= 6) { // Up to Testing phase
          await knex('repair_order_status_transitions').insert({
            id: `60000000-0000-0000-0000-${String(transitionId).padStart(12, '0')}`,
            from_status_id: workflowStatus.id,
            to_status_id: specialStatus.id,
            is_active: true,
            status: 'Open',
            created_by: '00000000-0000-0000-0000-000000000001', // Super admin
            created_at: knex.fn.now(),
            updated_at: knex.fn.now(),
          });
          transitionId++;
        }
      }
    }
  }
};