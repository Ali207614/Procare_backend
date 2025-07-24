import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import { RedisService } from 'src/common/redis/redis.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import bcrypt from 'bcrypt';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { CreateAdminDto } from './dto/create-admin.dto';
import { PermissionsService } from 'src/permissions/permissions.service';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { extractDefinedFields } from 'src/common/utils/extract-defined-fields.util';
import { FindAllAdminsDto } from './dto/find-all-admins.dto';
import { loadSQL } from 'src/common/utils/sql-loader.util';
import { ParseUUIDPipe } from '../common/pipe/parse-uuid.pipe';
import { RepairOrderStatusPermissionsService } from 'src/repair-order-status-permission/repair-order-status-permissions.service';
import { Admin } from 'src/common/types/admin.interface';
import { Branch } from 'src/common/types/branch.interface';
import { RepairOrderStatusPermission } from 'src/common/types/repair-order-status-permssion.interface';

@Injectable()
export class AdminsService {
  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly redisService: RedisService,
    private readonly permissionsService: PermissionsService,
    private readonly repairOrderStatusPermissions: RepairOrderStatusPermissionsService,
  ) {}

  private readonly table = 'admins';
  private readonly redisKeyByAdminRoles = 'admin_roles';

  async findByPhoneNumber(phone: string): Promise<Admin | undefined> {
    return this.knex(this.table).where({ phone_number: phone }).first();
  }

  async findById(id: string): Promise<Admin> {
    const sql: string = loadSQL('admins/queries/find-one.sql');

    const result = await this.knex.raw(sql, { admin_id: id });

    const admin: Admin = result.rows[0];

    if (!admin) {
      throw new NotFoundException({
        message: 'Admin not found',
        location: 'admin_not_found',
      });
    }

    return admin;
  }

  async findAll(query: FindAllAdminsDto): Promise<Admin[]> {
    const sql = loadSQL('admins/queries/find-all.sql');

    const data: { rows: Admin[] } = await this.knex.raw(sql, {
      search: query.search ?? null,
      status: query.status?.length ? query.status : null,
      branch_ids: query.branch_ids?.length ? query.branch_ids : null,
      role_ids: query.role_ids?.length ? query.role_ids : null,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });

    return data.rows;
  }

  async markPhoneVerified(phone: string): Promise<void> {
    await this.knex(this.table).where({ phone_number: phone }).update({
      phone_verified: true,
      verification_code: null,
      status: 'pending',
      updated_at: new Date(),
    });
  }

  async updateAdminByPhone(
    phone: string,
    data: Partial<Pick<Admin, 'password' | 'status'>>,
  ): Promise<void> {
    const updateData: Partial<Admin> = {
      updated_at: new Date(),
    };

    if (data.password) {
      updateData.password = data.password;
    }

    await this.knex(this.table).where({ phone_number: phone }).update(updateData);
  }

  checkAdminAccessControl(
    admin: Admin | undefined,
    options: { requireVerified?: boolean; blockIfVerified?: boolean } = {},
  ): void {
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

  async changePassword(admin: AdminPayload, dto: ChangePasswordDto): Promise<{ message: string }> {
    const dbAdmin: Admin = await this.findById(admin.id);

    const isMatch = await bcrypt.compare(dto.current_password, dbAdmin.password || '');
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

  async create(adminId: string, dto: CreateAdminDto): Promise<Admin> {
    const existing: Admin | undefined = await this.knex<Admin>('admins')
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
      const foundBranches: Branch[] = await this.knex('branches')
        .whereIn('id', dto.branch_ids)
        .andWhere({ is_active: true, status: 'Open' });

      if (foundBranches.length !== dto.branch_ids.length) {
        throw new BadRequestException({
          message: 'Some branch IDs are invalid or inactive',
          location: 'branch_ids',
        });
      }
    }

    const insertData: Partial<Admin> = {
      ...dto,
      birth_date: dto.birth_date ? new Date(dto.birth_date) : null,
      hire_date: dto.hire_date ? new Date(dto.hire_date) : null,
      passport_series: dto.passport_series ?? null,
      id_card_number: dto.id_card_number ?? null,
      created_by: adminId,
      status: 'Pending',
    };

    const inserted: Admin[] = await this.knex<Admin>('admins').insert(insertData).returning('*');

    const admin: Admin = inserted[0];

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

  async update(
    currentAdmin: AdminPayload,
    targetAdminId: string,
    dto: UpdateAdminDto & { role_ids?: string[]; branch_ids?: string[] },
  ): Promise<{ message: string }> {
    const target: Admin | undefined = await this.knex<Admin>('admins')
      .where({ id: targetAdminId })
      .andWhereNot({ status: 'Deleted' })
      .first();

    if (!target) {
      throw new NotFoundException({
        message: 'Admin not found',
        location: 'admin_not_found',
      });
    }

    if (
      target.is_protected &&
      (dto?.is_active === false || (Array.isArray(dto.role_ids) && dto.role_ids.length > 0))
    ) {
      throw new ForbiddenException({
        message: 'This admin is system-protected and cannot be deleted or deactivated.',
        location: 'admin_protected',
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
      const sensitiveFields: (keyof typeof dto)[] = [
        'passport_series',
        'birth_date',
        'hire_date',
        'id_card_number',
        'language',
        'role_ids',
        'branch_ids',
        'is_active',
      ];

      for (const field of sensitiveFields) {
        if (dto[field] !== undefined && !canEditOwnSensitive) {
          throw new ForbiddenException({
            message: `You cannot edit your ${field}`,
            location: field,
          });
        }
      }

      const basicFields: (keyof UpdateAdminDto)[] = ['first_name', 'last_name'];
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

    const updateData: Partial<Admin> = {
      ...extractDefinedFields(dto, [
        'first_name',
        'last_name',
        'passport_series',
        'id_card_number',
        'language',
        'is_active',
      ]),
      birth_date: dto.birth_date ? new Date(dto.birth_date) : null,
      hire_date: dto.hire_date ? new Date(dto.hire_date) : null,
      updated_at: new Date(),
    };

    if (Object.keys(updateData).length > 1) {
      await this.knex<Admin>('admins').where({ id: targetAdminId }).update(updateData);
    }

    if (dto.role_ids !== undefined || dto.branch_ids !== undefined) {
      const trx = await this.knex.transaction();

      try {
        if (dto.role_ids !== undefined) {
          await trx('admin_roles').where({ admin_id: targetAdminId }).del();

          if (dto.role_ids.length > 0) {
            const roleData = dto.role_ids.map((role_id) => ({
              admin_id: targetAdminId,
              role_id,
            }));
            await trx('admin_roles').insert(roleData);
          }
        }
        if (dto.branch_ids !== undefined) {
          if (!Array.isArray(dto.branch_ids) || dto.branch_ids.length === 0) {
            throw new BadRequestException({
              message: 'branch_ids must be a non-empty array',
              location: 'branch_ids',
            });
          }

          const parser = new ParseUUIDPipe();

          let branchIds: string[];

          try {
            branchIds = dto.branch_ids.map((id) => parser.transform(id));
          } catch {
            throw new BadRequestException({
              message: 'One or more branch IDs are not valid UUIDs',
              location: 'branch_ids',
            });
          }

          const foundBranches: Branch[] = await trx<Branch>('branches')
            .whereIn('id', branchIds)
            .andWhere({ status: 'Open' });

          const foundIds = foundBranches.map((b) => b.id);
          const missingIds = branchIds.filter((id) => !foundIds.includes(id));

          if (missingIds.length > 0) {
            throw new NotFoundException({
              message: 'Some branches were not found or inactive',
              location: 'branch_ids',
              missing_ids: missingIds,
            });
          }

          await trx('admin_branches').where({ admin_id: targetAdminId }).del();
          const branchData = branchIds.map((branch_id) => ({
            admin_id: targetAdminId,
            branch_id,
          }));
          await trx('admin_branches').insert(branchData);
        }

        await trx.commit();
      } catch (error) {
        await trx.rollback();

        if (error instanceof HttpException) {
          throw error;
        }

        throw new InternalServerErrorException({
          message: 'Failed to update admin roles or branches',
          location: 'admin_update_failure',
        });
      }

      if (dto.branch_ids !== undefined) {
        await this.redisService.del(`admin:${targetAdminId}:branches`);
      }
    }

    await this.permissionsService.clearPermissionCache(targetAdminId);
    await this.permissionsService.getPermissions(targetAdminId);

    await this.redisService.del(`admin:${targetAdminId}`);
    await this.redisService.del(`admins:branch:${targetAdminId}`);

    return { message: 'Admin updated successfully' };
  }

  async delete(requestingAdmin: AdminPayload, targetAdminId: string): Promise<{ message: string }> {
    const target: Admin | undefined = await this.knex<Admin>('admins')
      .where({ id: targetAdminId })
      .andWhereNot({ status: 'Deleted' })
      .first();

    if (!target) {
      throw new NotFoundException({
        message: 'Admin not found',
        location: 'admin_not_found',
      });
    }

    if (target?.is_protected) {
      throw new ForbiddenException({
        message: 'This admin is system-protected and cannot be deleted or deactivated.',
        location: 'admin_protected',
      });
    }

    if (requestingAdmin.id === target.id) {
      throw new ForbiddenException({
        message: 'You cannot delete yourself',
        location: 'self_delete',
      });
    }

    await this.knex('admins').where({ id: targetAdminId }).update({
      is_active: false,
      status: 'Deleted',
      updated_at: new Date(),
    });

    const permissions: RepairOrderStatusPermission[] = await this.knex(
      'repair_order_status_permissions',
    ).where({
      admin_id: targetAdminId,
    });

    if (permissions.length > 0) {
      await this.knex('repair_order_status_permissions').where({ admin_id: targetAdminId }).del();

      for (const permission of permissions) {
        await this.repairOrderStatusPermissions.flushAndReloadCacheByRole(permission);
      }
    }

    await this.permissionsService.clearPermissionCache(targetAdminId);

    await this.redisService.del(`admin:${targetAdminId}`);
    await this.redisService.del(`admins:branch:${targetAdminId}`);

    return {
      message: 'Admin deleted successfully',
    };
  }

  async findRolesByAdminId(adminId: string): Promise<string[]> {
    const key = `${this.redisKeyByAdminRoles}:${adminId}`;

    const cached: string[] | null = await this.redisService.get(key);
    if (cached !== null) return cached;

    const roles: { name: string }[] = await this.knex('admin_roles')
      .join('roles', 'admin_roles.role_id', 'roles.id')
      .where({ user_id: adminId })
      .andWhere('roles.status', 'Open')
      .select('roles.name');

    const result = roles.map((r) => r.name);

    await this.redisService.set(key, result, 3600);

    return result;
  }
}
