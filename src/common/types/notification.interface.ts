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
  phoneModel: string;
  status: string;
}
