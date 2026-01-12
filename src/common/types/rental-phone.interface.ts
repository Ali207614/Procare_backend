export interface RentalPhone {
  id: string;
  brand: string;
  model: string;
  imei: string;
  serial_number?: string;
  code?: string;
  condition: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  daily_rent_price: number;
  status: 'Available' | 'Rented' | 'Maintenance' | 'Lost' | 'Damaged' | 'Retired';
  category?: 'smartphone' | 'basic' | 'premium';
  color?: string;
  storage_capacity?: string;
  deposit_amount?: number;
  purchase_date?: string;
  warranty_expiry?: string;
  market_value?: number;
  supplier?: string;
  location?: string;
  specifications?: {
    screen_size?: string;
    processor?: string;
    ram?: string;
    battery_capacity?: string;
    camera?: string;
    os_version?: string;
    network?: string[];
    [key: string]: any;
  };
  notes?: string;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateRentalPhoneDto {
  brand: string;
  model: string;
  imei: string;
  serial_number?: string;
  code?: string;
  condition: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  daily_rent_price: number;
  category?: 'smartphone' | 'basic' | 'premium';
  color?: string;
  storage_capacity?: string;
  deposit_amount?: number;
  purchase_date?: string;
  warranty_expiry?: string;
  market_value?: number;
  supplier?: string;
  location?: string;
  specifications?: Record<string, any>;
  notes?: string;
}

export interface UpdateRentalPhoneDto {
  brand?: string;
  model?: string;
  imei?: string;
  serial_number?: string;
  code?: string;
  condition?: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  daily_rent_price?: number;
  status?: 'Available' | 'Rented' | 'Maintenance' | 'Lost' | 'Damaged' | 'Retired';
  category?: 'smartphone' | 'basic' | 'premium';
  color?: string;
  storage_capacity?: string;
  deposit_amount?: number;
  purchase_date?: string;
  warranty_expiry?: string;
  market_value?: number;
  supplier?: string;
  location?: string;
  specifications?: Record<string, any>;
  notes?: string;
  is_active?: boolean;
}

export interface RentalPhoneQueryDto {
  offset?: number;
  limit?: number;
  search?: string;
  status?: string | string[];
  condition?: string | string[];
  category?: string | string[];
  brand?: string | string[];
  min_price?: number;
  max_price?: number;
  location?: string;
  is_active?: boolean;
}
