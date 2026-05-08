import { BreadcrumbItem } from 'src/common/types/breadcrumb.interface';
import { RepairPart } from './repair-part.interface';

export interface ProblemCategory {
  id: string;
  name_uz: string;
  name_ru: string;
  name_en: string;
  parent_id: string | null;
  price: string; // yoki number, agar `.toString()` qilinmasa
  estimated_minutes: number;
  sort: number;
  is_active: boolean;
  status: 'Open' | 'Deleted';
  created_by: string | null;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

export interface ProblemCategoryWithMeta extends ProblemCategory {
  has_children: boolean;
  breadcrumb: BreadcrumbItem[];
  assigned_parts?: Partial<RepairPart>[];
}
