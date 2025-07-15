export interface Admin {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone_number: string;
  phone_verified: boolean;
  verification_code: string | null;
  password: string | null;
  is_protected: boolean;

  passport_series: string | null;
  birth_date: Date | null;
  hire_date: Date | null;
  id_card_number: string | null;
  language: string;

  is_active: boolean;
  status: 'Pending' | 'Open' | 'Deleted' | 'Banned';

  created_at: Date;
  updated_at: Date;
  created_by: string | null;
}
