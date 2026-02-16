export interface RepairOrderPickup {
  id: string;
  repair_order_id: string;
  lat: string;
  long: string;
  description: string;
  is_main: boolean;
  courier_id: string | null;
  status: 'Open' | 'Deleted';
  created_by: string;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export interface RepairOrderDelivery {
  id: string;
  repair_order_id: string;
  lat: string;
  long: string;
  description: string;
  is_main: boolean;
  courier_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}
