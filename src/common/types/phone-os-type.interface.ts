export interface PhoneOsType {
  id: string;
  name_uz: string;
  name_ru: string;
  name_en: string;
  sort: number;
  is_active: boolean;
  status: 'Open' | 'Deleted';
  created_by?: string | null;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}
