import { RoleType } from './role-type.enum';

export interface Role {
  id: string;
  name: string;
  type: RoleType | null;
  is_active: boolean;
  is_protected: boolean;
  status: 'Open' | 'Deleted';
  worker_count?: number;
  created_by: string | null;
  created_at: string; // yoki Date
  updated_at: string; // yoki Date
}

export interface RolePermission {
  role_id: string;
  permission_id: string;
}
