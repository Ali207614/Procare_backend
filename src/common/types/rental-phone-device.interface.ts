export interface RentalPhoneDevice {
  id: string;
  code: string;
  name: string;
  is_free: boolean;
  price: string;
  currency: 'UZS' | 'USD' | 'EUR';
  is_available: boolean;
  created_at: string;
}

export interface InsertableRentalPhoneDevice {
  code: string;
  name: string;
  is_free: boolean;
  price: string | null;
  currency: 'UZS' | 'USD' | 'EUR';
  is_available: boolean;
  is_synced_from_sap: boolean;
  created_at: Date;
  updated_at: Date;
}

export type RawSapPhone = {
  ItemCode: string;
  ItemName: string;
  U_IS_FREE: string;
  U_PRICE?: string;
};
