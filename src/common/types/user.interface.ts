export interface User {
  id: string;
  sap_card_code: string | null;
  first_name: string;
  last_name: string;
  phone_number: string;
  phone_verified: boolean;
  verification_code: string | null;
  password: string | null;
  passport_series: string | null;
  birth_date: string | null;
  id_card_number: string | null;
  language: string;
  is_active: boolean;
  status: 'Pending' | 'Open' | 'Deleted' | 'Banned';
  created_at: string;
  updated_at: string;
}