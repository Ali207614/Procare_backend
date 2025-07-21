export interface RepairOrderStatusPermission {
  id: string;
  branch_id: string;
  status_id: string;
  role_id: string;

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
  can_manage_rental_phone: boolean;
  can_view_history: boolean;
  can_user_manage: boolean;

  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}
