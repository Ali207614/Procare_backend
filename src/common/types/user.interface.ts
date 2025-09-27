export interface User {
  id: string;
  sap_card_code: string | null;
  first_name: string;
  last_name: string;
  phone_number1: string | null;
  phone_number2: string | null;
  phone_verified: boolean;
  verification_code: string | null;
  password: string | null;
  passport_series: string | null;
  birth_date: string | null;
  id_card_number: string | null;
  language: string;
  is_active: boolean;
  telegram_chat_id: string | null;
  telegram_username: string | null;
  source: 'telegram_bot' | 'employee' | 'web' | 'app' | 'other';
  roles: string[];
  status: 'Pending' | 'Open' | 'Deleted' | 'Banned';
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export type UserListItem = Pick<
  User,
  | 'id'
  | 'sap_card_code'
  | 'first_name'
  | 'last_name'
  | 'phone_number1'
  | 'phone_number2'
  | 'phone_verified'
  | 'passport_series'
  | 'birth_date'
  | 'id_card_number'
  | 'language'
  | 'telegram_chat_id'
  | 'telegram_username'
  | 'source'
  | 'status'
  | 'is_active'
  | 'created_at'
  | 'updated_at'
  | 'created_by'
>;
