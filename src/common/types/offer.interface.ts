export interface Offer {
  id: string;
  content_uz: string;
  content_ru: string | null;
  content_en: string | null;
  version: string;
  is_active: boolean;
  status: 'Open' | 'Deleted';
  created_at: Date;
  updated_at: Date;
}
