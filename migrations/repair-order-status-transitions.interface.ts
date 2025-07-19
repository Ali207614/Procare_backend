export interface RepairOrderStatusTransition {
  id: string;
  from_status_id: string;
  to_status_id: string;
  created_at: string; // yoki Date
  updated_at: string; // yoki Date
}
