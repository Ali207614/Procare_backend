export interface RepairOrderComment {
  id: string;
  repair_order_id: string;
  text: string;
  status: 'Open' | 'Deleted';
  created_by: string;
  status_by: string;
  created_at: string;
  updated_at: string;
}
