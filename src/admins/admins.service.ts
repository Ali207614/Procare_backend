
import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Knex } from 'knex';
import { InjectKnex } from 'nestjs-knex';
import { RedisService } from 'src/common/redis/redis.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import * as bcrypt from 'bcrypt';
import { AdminPayload } from 'src/common/types/admin-payload.interface';

@Injectable()
export class AdminsService {
    constructor(
        @InjectKnex() private readonly knex: Knex,
        private readonly redisService: RedisService,
    ) { }

    private readonly table = 'admins';


    async findByPhoneNumber(phone: string) {
        return this.knex(this.table).where({ phone_number: phone }).first();
    }

    async findById(id: string) {
        const admin = await this.knex(this.table).where({ id }).first();

        if (!admin) {
            throw new NotFoundException({
                message: 'Admin not found',
                location: 'admin_not_found',
            });
        }

        return admin;
    }



    async markPhoneVerified(phone: string) {
        await this.knex(this.table)
            .where({ phone_number: phone })
            .update({
                phone_verified: true,
                verification_code: null,
                status: 'pending',
                updated_at: new Date(),
            });
    }

    async updateAdminByPhone(phone: string, data: any) {
        await this.knex(this.table)
            .where({ phone_number: phone })
            .update({ ...data, updated_at: new Date() });
    }

    checkAdminAccessControl(admin: any, options: { requireVerified?: boolean; blockIfVerified?: boolean } = {}) {
        const { requireVerified = false, blockIfVerified = false } = options;

        if (!admin) {
            throw new UnauthorizedException({
                message: 'Admin not found',
                location: 'admin_not_found',
            });
        }
        if (admin?.status === 'Banned') {
            throw new BadRequestException({
                message: 'This phone number is banned',
                error: 'BannedAdmin',
                location: 'phone_banned',
            });
        }

        if (!admin?.is_active) {
            throw new BadRequestException({
                message: 'This phone number is inactive',
                error: 'InactiveAdmin',
                location: 'phone_inactive',
            });
        }


        if (blockIfVerified && admin?.phone_verified) {
            throw new BadRequestException({
                message: 'Phone number already verified',
                error: 'AlreadyVerified',
                location: 'phone_verified',
            });
        }

        if (requireVerified && !admin?.phone_verified) {
            throw new BadRequestException({
                message: 'Phone number not verified',
                error: 'PhoneNotVerified',
                location: 'phone_unverified',
            });
        }
    }

    async changePassword(admin: AdminPayload, dto: ChangePasswordDto) {
        const dbAdmin = await this.findById(admin.id);


        const isMatch = await bcrypt.compare(dto.current_password, dbAdmin.password);
        if (!isMatch) {
            throw new BadRequestException({
                message: '⛔ Current password is incorrect',
                location: 'wrong_current_password',
            });
        }

        const hashed = await bcrypt.hash(dto.new_password, 10);
        await this.knex(this.table)
            .where({ id: admin.id })
            .update({ password: hashed, updated_at: new Date() });

        return { message: '✅ Password changed successfully' };
    }
}
