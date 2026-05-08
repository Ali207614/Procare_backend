export interface RepairOrderRejectCause {
  id: string;
  name: string;
  description: string | null;
  sort: number;
  is_active: boolean;
  status: 'Open' | 'Deleted';
  created_at: string;
  updated_at: string;
}
