export interface Role {
  id: string;
  name: string;
  is_active: boolean;
  is_protected: boolean;
  status: 'Open' | 'Deleted';
  created_by: string | null;
  created_at: string; // yoki Date
  updated_at: string; // yoki Date
}

export interface RolePermission {
  role_id: string;
  permission_id: string;
}
