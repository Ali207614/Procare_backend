import { RepairOrderStatusPermission } from 'src/common/types/repair-order-status-permssion.interface';

export interface RepairOrderStatus {
  id: string;
  name_uz: string;
  name_ru: string;
  name_en: string;
  bg_color: string;
  color: string;
  sort: number;
  can_user_view: boolean;
  is_active: boolean;
  type: 'Completed' | 'Cancelled' | null;
  is_protected: boolean;
  can_add_payment: boolean;
  status: 'Open' | 'Deleted';
  branch_id: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RepairOrderStatusWithPermissions extends RepairOrderStatus {
  permissions: RepairOrderStatusPermission;
  transitions: string[];
}
