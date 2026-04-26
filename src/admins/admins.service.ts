import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import { RedisService } from 'src/common/redis/redis.service';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { CreateAdminDto } from './dto/create-admin.dto';
import { PermissionsService } from 'src/permissions/permissions.service';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { extractDefinedFields } from 'src/common/utils/extract-defined-fields.util';
import { FindAllAdminsDto } from './dto/find-all-admins.dto';
import { loadSQL } from 'src/common/utils/sql-loader.util';
import { ParseUUIDPipe } from '../common/pipe/parse-uuid.pipe';
import { Admin, AdminListItem } from 'src/common/types/admin.interface';
import { Branch } from 'src/common/types/branch.interface';
import { PaginationResult } from 'src/common/utils/pagination.util';
import { HistoryService } from 'src/history/history.service';

type AdminListItemWithTotal = AdminListItem & { total: number };

@Injectable()
export class AdminsService {
  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly redisService: RedisService,
    private readonly permissionsService: PermissionsService,
    private readonly historyService: HistoryService,
  ) {}

  private readonly table = 'admins';
  private readonly redisKeyByAdminRoles = 'admin_roles';
  private readonly redisKeyByAdminId = 'admin:branches';

  async findByPhoneNumber(phone: string): Promise<Admin | undefined> {
    return this.knex(this.table)
      .where({ phone_number: phone })
      .andWhereNot({ status: 'Deleted' })
      .first();
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

  async findAll(query: FindAllAdminsDto): Promise<PaginationResult<AdminListItem>> {
    const sql = loadSQL('admins/queries/find-all.sql');

    const data = await this.knex.raw(sql, {
      search: query.search ?? null,
      status: query.status?.length ? query.status : null,
      exclude_status: query.exclude_status?.length ? query.exclude_status : null,
      branch_ids: query.branch_ids?.length ? query.branch_ids : null,
      exclude_branch_ids: query.exclude_branch_ids?.length ? query.exclude_branch_ids : null,
      role_ids: query.role_ids?.length ? query.role_ids : null,
      exclude_role_ids: query.exclude_role_ids?.length ? query.exclude_role_ids : null,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });

    const rows = data.rows as AdminListItemWithTotal[];
    const total: number = rows.length > 0 ? Number(rows[0].total) : 0;

    return {
      rows: rows.map(({ total: _total, ...rest }) => rest),
      total,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    };
  }

  async markPhoneVerified(phone: string): Promise<void> {
    await this.knex(this.table).where({ phone_number: phone }).update({
      phone_verified: true,
      verification_code: null,
      status: 'Pending',
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

    if (data.status) {
      updateData.status = data.status;
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

  async create(adminId: string, dto: CreateAdminDto): Promise<Admin> {
    return this.knex.transaction(async (trx) => {
      const { role_ids, branch_ids, ...adminFields } = dto;

      const existing: Admin | undefined = await trx<Admin>('admins')
        .whereRaw('LOWER(phone_number) = ?', dto.phone_number.toLowerCase())
        .andWhereNot({ status: 'Deleted' })
        .first();

      if (existing) {
        throw new BadRequestException({
          message: 'Phone number already exists',
          location: 'phone_number',
        });
      }

      // Validate roles
      if (role_ids?.length) {
        const foundRoles = await trx('roles')
          .whereIn('id', role_ids)
          .andWhere({ is_active: true, status: 'Open' });

        if (foundRoles.length !== role_ids.length) {
          throw new BadRequestException({
            message: 'Some role IDs are invalid or inactive',
            location: 'role_ids',
          });
        }
      }

      if (branch_ids?.length) {
        const foundBranches: Branch[] = await trx('branches')
          .whereIn('id', branch_ids)
          .andWhere({ is_active: true, status: 'Open' });

        if (foundBranches.length !== branch_ids.length) {
          throw new BadRequestException({
            message: 'Some branch IDs are invalid or inactive',
            location: 'branch_ids',
          });
        }
      }

      const insertData: Partial<Admin> = {
        ...adminFields,
        birth_date: dto.birth_date ? new Date(dto.birth_date).toISOString() : null,
        hire_date: dto.hire_date ? new Date(dto.hire_date).toISOString() : null,
        passport_series: dto.passport_series ?? null,
        id_card_number: dto.id_card_number ?? null,
        onlinepbx_code: dto.onlinepbx_code ?? null,
        work_days: dto.work_days ?? undefined,
        work_start_time: dto.work_start_time ?? '09:00',
        work_end_time: dto.work_end_time ?? '18:00',
        created_by: adminId,
        status: 'Pending',
      };

      const inserted: Admin[] = await trx<Admin>('admins').insert(insertData).returning('*');

      const admin: Admin = inserted[0];

      await this.historyService.recordEntityCreated({
        db: trx,
        entityTable: 'admins',
        entityPk: admin.id,
        entityLabel: [admin.first_name, admin.last_name].filter(Boolean).join(' ') || null,
        actor: { actorPk: adminId },
        values: admin as unknown as Record<string, unknown>,
      });

      if (role_ids?.length) {
        const rolesData = role_ids.map((role_id) => ({
          admin_id: admin.id,
          role_id,
        }));
        await trx('admin_roles').insert(rolesData);
        for (const role_id of role_ids) {
          await this.historyService.recordRelationChanged({
            db: trx,
            actionKind: 'link',
            actor: { actorPk: adminId },
            from: { entityTable: 'admins', entityPk: admin.id },
            to: { entityTable: 'roles', entityPk: role_id },
            fieldPath: 'role_id',
          });
        }
      }

      if (branch_ids?.length) {
        const branchData = branch_ids.map((branch_id) => ({
          admin_id: admin.id,
          branch_id,
        }));
        await trx('admin_branches').insert(branchData);
        for (const branch_id of branch_ids) {
          await this.historyService.recordRelationChanged({
            db: trx,
            actionKind: 'link',
            actor: { actorPk: adminId },
            from: { entityTable: 'admins', entityPk: admin.id },
            to: { entityTable: 'branches', entityPk: branch_id },
            fieldPath: 'branch_id',
          });
        }
      }

      await this.permissionsService.getPermissions(admin.id);
      await this.permissionsService.clearPermissionCache(admin.id);

      return admin;
    });
  }

  async update(
    currentAdmin: AdminPayload,
    targetAdminId: string,
    dto: UpdateAdminDto,
  ): Promise<{ message: string }> {
    const { role_ids, branch_ids } = dto;

    const result = await this.knex.transaction(async (trx) => {
      const target: Admin | undefined = await trx<Admin>('admins')
        .where({ id: targetAdminId })
        .andWhereNot({ status: 'Deleted' })
        .first();

      if (!target) {
        throw new NotFoundException({
          message: 'Admin not found',
          location: 'admin_not_found',
        });
      }

      if (dto.phone_number) {
        const existingAdmin: Admin | undefined = await trx<Admin>('admins')
          .where({ phone_number: dto.phone_number })
          .andWhereNot({ id: targetAdminId })
          .andWhereNot({ status: 'Deleted' })
          .first();

        if (existingAdmin) {
          throw new BadRequestException({
            message: 'This phone number is already used by another admin',
            location: 'phone_number',
          });
        }
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

      const canEditOthers = permissions.includes('admin.manage.update');
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
          'phone_number',
          'language',
          'role_ids',
          'branch_ids',
          'is_active',
          'onlinepbx_code',
          'work_days',
          'work_start_time',
          'work_end_time',
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

      const { role_ids, branch_ids, ...adminFields } = dto;
      const previousRoleIds =
        role_ids !== undefined
          ? await trx('admin_roles').where({ admin_id: targetAdminId }).pluck<string>('role_id')
          : [];
      const previousBranchIds =
        branch_ids !== undefined
          ? await trx('admin_branches')
              .where({ admin_id: targetAdminId })
              .pluck<string>('branch_id')
          : [];

      const updateData: Partial<Admin> = {
        ...extractDefinedFields(adminFields, [
          'first_name',
          'last_name',
          'passport_series',
          'id_card_number',
          'phone_number',
          'language',
          'is_active',
          'onlinepbx_code',
          'work_days',
          'work_start_time',
          'work_end_time',
        ]),
        ...(dto.birth_date !== undefined && {
          birth_date: dto.birth_date ? new Date(dto.birth_date).toISOString() : null,
        }),
        ...(dto.hire_date !== undefined && {
          hire_date: dto.hire_date ? new Date(dto.hire_date).toISOString() : null,
        }),
        updated_at: new Date(),
      };

      if (Object.keys(updateData).length > 0) {
        await trx<Admin>('admins').where({ id: targetAdminId }).update(updateData);
        await this.historyService.recordEntityUpdated({
          db: trx,
          entityTable: 'admins',
          entityPk: targetAdminId,
          entityLabel: [target.first_name, target.last_name].filter(Boolean).join(' ') || null,
          actor: { actorPk: currentAdmin.id },
          before: target as unknown as Record<string, unknown>,
          after: { ...target, ...updateData } as Record<string, unknown>,
          fields: Object.keys(updateData).filter((field) => field !== 'updated_at'),
        });
      }

      if (role_ids !== undefined) {
        await trx('admin_roles').where({ admin_id: targetAdminId }).del();

        if (role_ids.length > 0) {
          const foundRoles = await trx('roles')
            .whereIn('id', role_ids)
            .andWhere({ is_active: true, status: 'Open' });

          if (foundRoles.length !== role_ids.length) {
            throw new BadRequestException({
              message: 'Some role IDs are invalid or inactive',
              location: 'role_ids',
            });
          }

          const roleData = role_ids.map((role_id) => ({
            admin_id: targetAdminId,
            role_id,
          }));
          await trx('admin_roles').insert(roleData);
        }

        await this.recordRelationDiff(trx, {
          actorAdminId: currentAdmin.id,
          fromTable: 'admins',
          fromPk: targetAdminId,
          toTable: 'roles',
          fieldPath: 'role_id',
          beforeIds: previousRoleIds,
          afterIds: role_ids,
        });
      }

      if (branch_ids !== undefined) {
        if (branch_ids.length === 0) {
          await trx('admin_branches').where({ admin_id: targetAdminId }).del();
        } else {
          const parser = new ParseUUIDPipe();
          let branchIds: string[];
          try {
            branchIds = branch_ids.map((id) => parser.transform(id));
          } catch {
            throw new BadRequestException({
              message: 'One or more branch IDs are not valid UUIDs',
              location: 'branch_ids',
            });
          }

          const foundBranches: Branch[] = await trx<Branch>('branches')
            .whereIn('id', branchIds)
            .andWhere({ status: 'Open', is_active: true });

          const foundIds = foundBranches.map((b) => b.id);
          const missingIds = branchIds.filter((id) => !foundIds.includes(id));

          if (missingIds.length > 0) {
            throw new NotFoundException({
              message: 'Some branches were not found or inactive',
              location: 'branch_ids',
            });
          }

          await trx('admin_branches').where({ admin_id: targetAdminId }).del();
          const branchData = branchIds.map((branch_id) => ({
            admin_id: targetAdminId,
            branch_id,
          }));
          await trx('admin_branches').insert(branchData);
        }

        await this.recordRelationDiff(trx, {
          actorAdminId: currentAdmin.id,
          fromTable: 'admins',
          fromPk: targetAdminId,
          toTable: 'branches',
          fieldPath: 'branch_id',
          beforeIds: previousBranchIds,
          afterIds: branch_ids,
        });
      }

      return { message: 'Admin updated successfully' };
    });

    // --- Flush Cache After Commit ---
    if (role_ids !== undefined) {
      await this.redisService.del(`${this.redisKeyByAdminRoles}:${targetAdminId}`);
      await this.redisService.del(`admin:${targetAdminId}:permissions`);
    }

    if (branch_ids !== undefined) {
      await this.redisService.flushByPrefix(`${this.redisKeyByAdminId}:${targetAdminId}`);
    }

    await this.permissionsService.clearPermissionCache(targetAdminId);
    await this.permissionsService.getPermissions(targetAdminId);

    await this.redisService.del(`admin:${targetAdminId}`);

    return result;
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

    await this.knex.transaction(async (trx) => {
      await trx('admins').where({ id: targetAdminId }).update({
        is_active: false,
        status: 'Deleted',
        updated_at: new Date(),
      });

      await this.historyService.recordEntityDeleted({
        db: trx,
        entityTable: 'admins',
        entityPk: targetAdminId,
        entityLabel: [target.first_name, target.last_name].filter(Boolean).join(' ') || null,
        actor: { actorPk: requestingAdmin.id },
        before: target as unknown as Record<string, unknown>,
        fields: ['status', 'is_active'],
      });
    });

    await this.redisService.flushByPrefix(`${this.redisKeyByAdminId}:${targetAdminId}`);
    await this.redisService.del(`${this.redisKeyByAdminRoles}:${targetAdminId}`);

    await this.permissionsService.clearPermissionCache(targetAdminId);

    await this.redisService.del(`admin:${targetAdminId}`);

    return {
      message: 'Admin deleted successfully',
    };
  }

  async findRolesByAdminId(adminId: string): Promise<{ name: string; id: string }[]> {
    const key = `${this.redisKeyByAdminRoles}:${adminId}`;

    const cached: { name: string; id: string }[] | null = await this.redisService.get(key);
    if (cached !== null) return cached;

    const roles: { name: string; id: string }[] = await this.knex('admin_roles')
      .join('roles', 'admin_roles.role_id', 'roles.id')
      .where({ admin_id: adminId })
      .andWhere('roles.status', 'Open')
      .orderBy('admin_roles.role_id', 'asc')
      .select('roles.name', 'roles.id');

    const result = roles.map((r) => {
      return { id: r.id, name: r.name };
    });

    await this.redisService.set(key, result, 3600);

    return result;
  }

  async findBranchesByAdminId(adminId: string): Promise<{ id: string; name_uz: string }[]> {
    const key = `${this.redisKeyByAdminId}:${adminId}`;

    const cached: { id: string; name_uz: string }[] | null = await this.redisService.get(key);
    if (cached !== null) return cached;

    const branches: { id: string; name_uz: string }[] = await this.knex('admin_branches')
      .join('branches', 'admin_branches.branch_id', 'branches.id')
      .where({ admin_id: adminId })
      .andWhere('branches.status', 'Open')
      .select('branches.id', 'branches.name_uz');

    await this.redisService.set(key, branches, 3600);

    return branches;
  }

  private async recordRelationDiff(
    trx: Knex.Transaction,
    params: {
      actorAdminId: string;
      fromTable: string;
      fromPk: string;
      toTable: string;
      fieldPath: string;
      beforeIds: string[];
      afterIds: string[];
    },
  ): Promise<void> {
    const before = new Set(params.beforeIds);
    const after = new Set(params.afterIds);

    for (const id of params.afterIds.filter((item) => !before.has(item))) {
      await this.historyService.recordRelationChanged({
        db: trx,
        actionKind: 'link',
        actor: { actorPk: params.actorAdminId },
        from: { entityTable: params.fromTable, entityPk: params.fromPk },
        to: { entityTable: params.toTable, entityPk: id },
        fieldPath: params.fieldPath,
      });
    }

    for (const id of params.beforeIds.filter((item) => !after.has(item))) {
      await this.historyService.recordRelationChanged({
        db: trx,
        actionKind: 'unlink',
        actor: { actorPk: params.actorAdminId },
        from: { entityTable: params.fromTable, entityPk: params.fromPk },
        to: { entityTable: params.toTable, entityPk: id },
        fieldPath: params.fieldPath,
      });
    }
  }
}
