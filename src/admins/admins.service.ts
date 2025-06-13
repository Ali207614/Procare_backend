
import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Knex } from 'knex';
import { InjectKnex } from 'nestjs-knex';
import { RedisService } from 'src/common/redis/redis.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import * as bcrypt from 'bcrypt';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { CreateAdminDto } from './dto/create-admin.dto';
import { PermissionsService } from 'src/permissions/permissions.service';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { extractDefinedFields } from 'src/common/utils/extract-defined-fields.util';

@Injectable()
export class AdminsService {
    constructor(
        @InjectKnex() private readonly knex: Knex,
        private readonly redisService: RedisService,
        private readonly permissionsService: PermissionsService
    ) { }

    private readonly table = 'admins';


    async findByPhoneNumber(phone: string) {
        return this.knex(this.table).where({ phone_number: phone, }).first();
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

    async create(adminId: string, dto: CreateAdminDto) {
        const existing = await this.knex('admins')
            .whereRaw('LOWER(phone_number) = ?', dto.phone_number.toLowerCase())
            .andWhereNot({ status: 'Deleted' })
            .first();

        if (existing) {
            throw new BadRequestException({
                message: 'Phone number already exists',
                location: 'phone_number',
            });
        }

        if (dto.role_ids?.length) {
            const foundRoles = await this.knex('roles')
                .whereIn('id', dto.role_ids)
                .andWhere({ is_active: true, status: 'Open' });

            if (foundRoles.length !== dto.role_ids.length) {
                throw new BadRequestException({
                    message: 'Some role IDs are invalid or inactive',
                    location: 'role_ids',
                });
            }
        }

        if (dto.branch_ids?.length) {
            const foundBranches = await this.knex('branches')
                .whereIn('id', dto.branch_ids)
                .andWhere({ is_active: true, status: 'Open' });

            if (foundBranches.length !== dto.branch_ids.length) {
                throw new BadRequestException({
                    message: 'Some branch IDs are invalid or inactive',
                    location: 'branch_ids',
                });
            }
        }

        const [admin] = await this.knex('admins')
            .insert({
                ...dto,
                status: 'Pending',
                created_by: adminId
            })
            .returning('*');

        if (dto?.role_ids?.length) {
            const rolesData = dto.role_ids.map((role_id) => ({
                admin_id: admin.id,
                role_id,
            }));
            await this.knex('admin_roles').insert(rolesData);
        }

        if (dto?.branch_ids?.length) {
            const branchData = dto.branch_ids.map((branch_id) => ({
                admin_id: admin.id,
                branch_id,
            }));
            await this.knex('admin_branches').insert(branchData);

            await this.redisService.del(`admin:${admin.id}:branches`);
        }
        await this.permissionsService.getPermissions(admin.id);

        return admin;
    }

    async update(currentAdmin: any, targetAdminId: string, dto: UpdateAdminDto & { role_ids?: string[], branch_ids?: string[] }) {
        const target = await this.knex('admins').where({ id: targetAdminId }).first();

        if (!target) {
            throw new NotFoundException({
                message: 'Admin not found',
                location: 'admin_not_found',
            });
        }

        const isSelf = currentAdmin.id === target.id;
        const permissions = await this.permissionsService.getPermissions(currentAdmin.id);

        const canEditOthers = permissions.includes('admin.manage.edit');
        const canEditOwnBasic = permissions.includes('admin.profile.edit.basic');
        const canEditOwnSensitive = permissions.includes('admin.profile.edit.sensitive');

        if (!isSelf && !canEditOthers) {
            throw new ForbiddenException({
                message: 'You cannot edit other admins',
                location: 'edit_forbidden',
            });
        }

        if (isSelf && !canEditOthers) {
            const sensitiveFields = ['passport_series', 'birth_date', 'hire_date', 'id_card_number', 'language', 'role_ids', 'branch_ids'];
            for (const field of sensitiveFields) {
                if (dto[field] !== undefined && !canEditOwnSensitive) {
                    throw new ForbiddenException({
                        message: `You cannot edit your ${field}`,
                        location: field,
                    });
                }
            }

            const basicFields = ['first_name', 'last_name'];
            if (!canEditOwnBasic) {
                for (const field of basicFields) {
                    if (dto[field] !== undefined) {
                        throw new ForbiddenException({
                            message: `You cannot edit your ${field}`,
                            location: field,
                        });
                    }
                }
            }
        }

        const updateData: Record<string, any> = extractDefinedFields(dto, [
            'first_name',
            'last_name',
            'passport_series',
            'birth_date',
            'hire_date',
            'id_card_number',
            'language',
        ]);

        updateData.updated_at = new Date();

        if (Object.keys(updateData).length > 1) {
            await this.knex('admins')
                .where({ id: targetAdminId })
                .update(updateData);
        }

        if (dto.role_ids !== undefined || dto.branch_ids !== undefined) {
            const trx = await this.knex.transaction();

            try {
                // 🟩 Role IDs update
                if (dto.role_ids !== undefined) {
                    await trx('admin_roles').where({ admin_id: targetAdminId }).del();

                    if (Array.isArray(dto.role_ids) && dto.role_ids.length > 0) {
                        const roleData = dto.role_ids.map(role_id => ({
                            admin_id: targetAdminId,
                            role_id,
                        }));
                        await trx('admin_roles').insert(roleData);
                    }
                }

                // 🟦 Branch IDs update
                if (dto.branch_ids !== undefined) {
                    await trx('admin_branches').where({ admin_id: targetAdminId }).del();

                    if (Array.isArray(dto.branch_ids) && dto.branch_ids.length > 0) {
                        const branchData = dto.branch_ids.map(branch_id => ({
                            admin_id: targetAdminId,
                            branch_id,
                        }));
                        await trx('admin_branches').insert(branchData);
                    }
                }

                await trx.commit();

            } catch (error) {
                await trx.rollback();
                throw new InternalServerErrorException({
                    message: 'Failed to update admin roles or branches',
                    location: 'admin_update_failure',
                });
            }

            // ❗ Redisni transaction tashqarisida o‘chirish kerak
            if (dto.branch_ids !== undefined) {
                await this.redisService.del(`admin:${targetAdminId}:branches`);
            }
        }

        await this.permissionsService.clearPermissionCache(targetAdminId);
        await this.permissionsService.getPermissions(targetAdminId);

        return {
            message: 'Admin updated successfully',
        };
    }

    async delete(requestingAdmin: any, targetAdminId: string) {
        const target = await this.knex('admins').where({ id: targetAdminId }).first();

        if (!target) {
            throw new NotFoundException({
                message: 'Admin not found',
                location: 'admin_not_found',
            });
        }

        if (requestingAdmin.id === target.id) {
            throw new ForbiddenException({
                message: 'You cannot delete yourself',
                location: 'self_delete',
            });
        }

        const permissions = await this.permissionsService.getPermissions(requestingAdmin.id);

        if (!permissions.includes('admin.manage.delete')) {
            throw new ForbiddenException({
                message: 'You do not have permission to delete admins',
                location: 'permission_denied',
            });
        }

        await this.knex('admins')
            .where({ id: targetAdminId })
            .update({
                is_active: false,
                status: 'Deleted',
                updated_at: new Date(),
            });

        await this.permissionsService.clearPermissionCache(targetAdminId);

        return {
            message: 'Admin deleted successfully',
            deleted_admin_id: targetAdminId,
        };
    }


}
