interface StatusPermissionFields {
  can_add: boolean;
  can_view: boolean;
  can_update: boolean;
  can_delete: boolean;
  can_payment_add: boolean;
  can_payment_cancel: boolean;
  can_assign_admin: boolean;
  can_notification: boolean;
  can_notification_bot: boolean;
  can_change_active: boolean;
  can_change_status: boolean;
  can_view_initial_problems: boolean;
  can_change_initial_problems: boolean;
  can_view_final_problems: boolean;
  can_change_final_problems: boolean;
  can_comment: boolean;
  can_pickup_manage: boolean;
  can_delivery_manage: boolean;
  can_view_payments: boolean;
  can_view_history: boolean;
}

export function extractStatusPermissionFields(
  row: Record<string, unknown>,
): StatusPermissionFields {
  const {
    can_add,
    can_view,
    can_update,
    can_delete,
    can_payment_add,
    can_payment_cancel,
    can_assign_admin,
    can_notification,
    can_notification_bot,
    can_change_active,
    can_change_status,
    can_view_initial_problems,
    can_change_initial_problems,
    can_view_final_problems,
    can_change_final_problems,
    can_comment,
    can_pickup_manage,
    can_delivery_manage,
    can_view_payments,
    can_view_history,
  } = row as unknown as StatusPermissionFields;

  return {
    can_add,
    can_view,
    can_update,
    can_delete,
    can_payment_add,
    can_payment_cancel,
    can_assign_admin,
    can_notification,
    can_notification_bot,
    can_change_active,
    can_change_status,
    can_view_initial_problems,
    can_change_initial_problems,
    can_view_final_problems,
    can_change_final_problems,
    can_comment,
    can_pickup_manage,
    can_delivery_manage,
    can_view_payments,
    can_view_history,
  };
}
