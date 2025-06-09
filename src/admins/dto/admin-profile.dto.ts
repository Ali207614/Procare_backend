import { Exclude, Expose } from 'class-transformer';

export class AdminProfileDto {
    @Expose()
    id: string;

    @Expose()
    name: string;

    @Expose()
    phone: string;

    @Expose()
    login: string;

    @Expose()
    is_active: boolean;

    @Exclude()
    password: boolean;

    @Expose()
    status: string;

    @Expose()
    created_at: Date;

    @Expose()
    updated_at: Date;
}
