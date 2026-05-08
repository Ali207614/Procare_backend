import { BreadcrumbItem } from 'src/common/types/breadcrumb.interface';

export interface PhoneCategory {
  id: string;
  name_uz: string;
  name_ru: string;
  name_en: string;
  telegram_sticker?: string | null;
  phone_os_type_id?: string | null;
  parent_id?: string | null;
  sort: number;
  status: 'Open' | 'Deleted';
  is_active: boolean;
  created_by?: string | null;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

export interface PhoneCategoryWithMeta {
  id: string;
  name_uz: string;
  name_ru: string;
  name_en: string;
  telegram_sticker?: string | null;
  phone_os_type_id?: string | null;
  parent_id?: string | null;
  sort: number;
  status: 'Open' | 'Deleted';
  is_active: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  has_children: boolean;
  has_problems: boolean;
  breadcrumb: BreadcrumbItem[];
}
