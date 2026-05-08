export interface RepairPart {
  id: string;
  part_name_uz: string;
  part_name_ru: string;
  part_name_en: string;
  part_price: number;
  quantity: number;
  description_uz?: string;
  description_ru?: string;
  description_en?: string;
  is_required: boolean | null;
  status: 'Open' | 'Deleted';
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}
