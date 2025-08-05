export interface AdminPayload {
  id: string;
  phone_number: string;
  roles: { name: string; id: string }[];
}
