export interface RentalPhoneDevice {
  id: string;
  code: string;
  name: string;
  brand: string | null;
  model: string | null;
  imei: string | null;
  serial_number: string | null;
  color: string | null;
  storage_capacity: string | null;
  is_free: boolean;
  daily_rent_price: number;
  deposit_amount: number;
  currency: 'UZS' | 'USD' | 'EUR';
  is_available: boolean;
  status: 'Available' | 'Rented' | 'Maintenance' | 'Lost' | 'Damaged' | 'Retired';
  condition: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  quantity: number;
  quantity_available: number;
  notes: string | null;
  specifications: string | null;
  sort: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateRentalPhoneDeviceDto {
  code: string;
  name: string;
  brand?: string;
  model?: string;
  imei?: string;
  serial_number?: string;
  color?: string;
  storage_capacity?: string;
  is_free?: boolean;
  daily_rent_price: number;
  deposit_amount?: number;
  currency?: 'UZS' | 'USD' | 'EUR';
  is_available?: boolean;
  status?: 'Available' | 'Rented' | 'Maintenance' | 'Lost' | 'Damaged' | 'Retired';
  condition?: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  quantity?: number;
  quantity_available?: number;
  notes?: string;
  specifications?: string;
  sort?: number;
}

export interface UpdateRentalPhoneDeviceDto {
  code?: string;
  name?: string;
  brand?: string;
  model?: string;
  imei?: string;
  serial_number?: string;
  color?: string;
  storage_capacity?: string;
  is_free?: boolean;
  daily_rent_price?: number;
  deposit_amount?: number;
  currency?: 'UZS' | 'USD' | 'EUR';
  is_available?: boolean;
  status?: 'Available' | 'Rented' | 'Maintenance' | 'Lost' | 'Damaged' | 'Retired';
  condition?: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  quantity?: number;
  quantity_available?: number;
  notes?: string;
  specifications?: string;
  sort?: number;
  is_active?: boolean;
}

export interface RentalPhoneDeviceQueryDto {
  offset?: number;
  limit?: number;
  search?: string;
  brand?: string | string[];
  status?: string | string[];
  condition?: string | string[];
  is_available?: boolean;
  is_free?: boolean;
  min_price?: number;
  max_price?: number;
  is_active?: boolean;
}

// This interface is deprecated - use RentalPhoneDevice instead
export interface LegacyRentalPhoneDevice {
  id: string;
  code: string;
  name: string;
  is_free: boolean;
  price: string;
  currency: 'UZS' | 'USD' | 'EUR';
  is_available: boolean;
  created_at: string;
}
