export interface Branch {
  id: string;

  name_uz: string;
  name_ru: string;
  name_en: string;

  address_uz?: string | null;
  address_ru?: string | null;
  address_en?: string | null;

  is_protected: boolean;
  can_user_view: boolean;

  lat?: number | null;
  long?: number | null;

  support_phone?: string | null;
  work_start_time?: string | null; // Format: HH:mm:ss
  work_end_time?: string | null;   // Format: HH:mm:ss

  bg_color?: string | null;
  color?: string | null;

  status: 'Open' | 'Deleted';
  sort: number;
  is_active: boolean;

  created_by?: string | null;

  created_at: Date;
  updated_at: Date;
}
