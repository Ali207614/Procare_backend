export interface WorkDays {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
}

export interface AdminRoleSummary {
  id: string;
  name: string;
}

export interface AdminBranchSummary {
  id: string;
  name_uz: string;
  name_ru: string;
  name_en: string;
}

export interface Admin {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone_number: string;
  phone_verified: boolean;
  verification_code: string | null;
  password: string | null;
  is_protected: boolean;
  onlinepbx_code: string | null;
  work_days: WorkDays;
  work_start_time: string;
  work_end_time: string;

  passport_series: string | null;
  birth_date: string | null;
  hire_date: string | null;
  id_card_number: string | null;
  language: string;

  is_active: boolean;
  status: 'Pending' | 'Open' | 'Deleted' | 'Banned';

  created_at: Date;
  updated_at: Date;
  created_by: string | null;
}

export interface AdminListItem {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone_number: string;
  is_active: boolean;
  language: string;
  status: Admin['status'];
  roles: AdminRoleSummary[];
  branches: AdminBranchSummary[];
}
