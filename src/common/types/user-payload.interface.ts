export interface UserPayload {
    id: string;
    phone_number: string;
    role: string;
    iat?: number;
    exp?: number;
}
