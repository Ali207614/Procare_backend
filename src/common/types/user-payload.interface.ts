export interface UserPayload {
  id: string;
  phone_number: string;
  roles: string[];
  iat?: number;
  exp?: number;
}
