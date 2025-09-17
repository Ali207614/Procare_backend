export interface CourierRepairOrder {
  repair_order_id: string;
  type: 'pickup' | 'delivery';
  status_name_uz: string;
  status_name_ru: string;
  status_name_en: string;
}

export interface CourierBranch {
  id: string;
  name_uz: string;
  name_ru: string;
  name_en: string;
}

export interface Courier {
  id: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  status: 'Open' | 'Deleted';
  is_active: boolean;
  created_at: string;
  total: number;
  repair_orders: CourierRepairOrder[];
  branches: CourierBranch[];
}
