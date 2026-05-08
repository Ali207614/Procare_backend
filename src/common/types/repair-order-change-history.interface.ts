export interface RepairOrderChangeHistory {
  id: string;
  repair_order_id: string;
  field: string;
  old_value: unknown;
  new_value: unknown;
  created_by: string;
  is_system?: boolean | null;
  created_at: string | Date;
}
