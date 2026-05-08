export interface RepairOrderStatusTransition {
  id: string;
  from_status_id: string;
  to_status_id: string;
  role_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RepairOrderStatusTransferPermission {
  status_id: string;
  role_id: string | null;
  transitions: string[];
}

export interface RepairOrderStatusTransferPermissionsResult {
  branch_id: string;
  role_id: string;
  source: 'role' | 'fallback';
  rows: RepairOrderStatusTransferPermission[];
}
