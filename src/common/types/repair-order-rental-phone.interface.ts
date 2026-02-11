export interface RepairOrderRentalPhone {
  id: string;
  repair_order_id: string;
  rental_phone_device_id: string;
  is_free: boolean | null;
  price: string | null;
  currency: 'UZS' | 'USD' | 'EUR' | null;
  status: 'Active' | 'Returned' | 'Cancelled';
  rented_at: string; // yoki Date
  returned_at: string | null;
  notes: string | null;
  created_by: string;
  created_at: string; // yoki Date
  updated_at: string; // yoki Date
}
