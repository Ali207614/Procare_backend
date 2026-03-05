export interface Notification {
  id: string;
  admin_id: string;

  title: string;
  message: string;

  type: 'info' | 'success' | 'warning' | 'error' | 'custom';

  is_read: boolean;
  meta: Record<string, unknown> | null;

  read_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface NotificationPayload {
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error' | 'custom';
  meta?: Record<string, unknown>;
}

export interface BroadcastMessage<M = unknown> {
  title: string;
  message: string;
  meta: M | null;
}

export interface RepairNotificationMeta {
  order_id: string;
  number_id: string;
  sort: number;
  phone_category_name: string | null;
  user_full_name: string | null;
  user_phone_number: string | null;
  pickup_method: string;
  delivery_method: string;
  priority: string;
  source: string;
  assigned_admins: string | null;
  action?: string;
  from_status_id?: string;
  to_status_id?: string;
}
