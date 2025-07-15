export interface Notification {
  id: string;
  admin_id: string;

  title: string;
  message: string;

  type: 'info' | 'success' | 'warning' | 'error' | 'custom';

  is_read: boolean;
  meta: Record<string, any> | null;

  read_at: Date | null;
  created_at: Date;
  updated_at: Date;
}
