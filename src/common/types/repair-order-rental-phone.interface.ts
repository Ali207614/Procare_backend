export interface RepairOrderRentalPhone {
  id: string;
  repair_order_id: string;
  rental_phone_device_id: string | null;
  imei: string | null;
  is_free: boolean | null;
  price: string | null;
  currency: 'UZS' | 'USD' | 'EUR' | null;
  status: 'Active' | 'Returned' | 'Cancelled' | 'Pending';
  rented_at: string | null; // yoki Date
  returned_at: string | null;
  notes: string | null;
  marked_as_returned_by: string | null;
  marked_as_cancelled_by: string | null;
  created_by: string;
  created_at: string; // yoki Date
  updated_at: string; // yoki Date
  toggle?: boolean;
}
