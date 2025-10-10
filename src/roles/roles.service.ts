import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectKnex, Knex } from 'nestjs-knex';
import { RedisService } from 'src/common/redis/redis.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Permission } from 'src/common/types/permission.interface';
import { Role } from 'src/common/types/role.interface';
import { RepairOrderStatusPermissionsService } from 'src/repair-order-status-permission/repair-order-status-permissions.service';
import { PaginationResult } from 'src/common/utils/pagination.util';
import { EnumBooleanString, FindAllRolesDto } from 'src/roles/dto/find-all-roles.dto';
import { HasTelegramFilter } from 'src/users/dto/find-all-user.dto';

export interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

@Injectable()
export class RolesService {
  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly redisService: RedisService,
    private readonly repairOrderStatusPermissionsService: RepairOrderStatusPermissionsService,
  ) {}

  async create(dto: CreateRoleDto, adminId: string): Promise<Role> {
    return this.knex.transaction(async (trx) => {
      const existing = await trx('roles')
        .whereRaw('LOWER(name) = ?', dto.name.toLowerCase())
        .andWhere({ status: 'Open' })
        .first();

      if (existing) {
        throw new BadRequestException({
          message: 'Role name already exists',
          location: 'role_name',
        });
      }

      // 2️⃣ Permission ID-larni tekshirish
      if (dto.permission_ids?.length) {
        const foundPermissions: Permission[] = await trx('permissions')
          .whereIn('id', dto.permission_ids)
          .andWhere({ is_active: true, status: 'Open' });

        if (foundPermissions.length !== dto.permission_ids.length) {
          throw new BadRequestException({
            message: 'Some permission IDs are invalid or inactive',
            location: 'permission_ids',
          });
        }
      }

      const [role]: Role[] = await trx('roles')
        .insert({
          name: dto.name,
          created_by: adminId,
        })
        .returning('*');

      if (dto.permission_ids?.length) {
        const mappings = dto.permission_ids.map((permission_id) => ({
          role_id: role.id,
          permission_id,
        }));

        await trx('role_permissions').insert(mappings);
      }

      return role;
    });
  }

  async findAll(dto: FindAllRolesDto): Promise<PaginationResult<Role>> {
    const { search, is_active, is_protected, limit = 20, offset = 0 } = dto;

    const baseQuery = this.knex('roles as r')
      .leftJoin('admins as a', 'r.created_by', 'a.id')
      .where('r.status', 'Open')
      .modify((qb) => {
        if (search) {
          void qb.andWhereRaw('LOWER(r.name) LIKE ?', [`%${search.toLowerCase()}%`]);
        }

        if (is_active === EnumBooleanString.TRUE) {
          void qb.andWhere('r.is_active', true);
        } else if (is_active === EnumBooleanString.FALSE) {
          void qb.andWhere('r.is_active', false);
        }

        if (is_protected === EnumBooleanString.TRUE) {
          void qb.andWhere('r.is_protected', true);
        } else if (is_protected === EnumBooleanString.FALSE) {
          void qb.andWhere('r.is_protected', false);
        }
      });

    const [rows, [{ count }]] = await Promise.all([
      baseQuery
        .clone()
        .select(
          'r.id',
          'r.name',
          'r.is_active',
          'r.is_protected',
          'r.status',
          'r.created_at',
          'r.updated_at',
          this.knex.raw(`
          COALESCE(
            jsonb_build_object(
              'first_name', a.first_name,
              'last_name', a.last_name,
              'phone_number', a.phone_number
            ),
            '{}'::jsonb
          ) as created_by_admin
        `),
        )
        .orderBy('r.created_at', 'desc')
        .limit(limit)
        .offset(offset),

      baseQuery.clone().count('* as count'),
    ]);

    return {
      rows,
      total: Number(count),
      limit,
      offset,
    };
  }

  async findOne(id: string): Promise<RoleWithPermissions> {
    const role = await this.knex('roles as r')
      .select(
        'r.id',
        'r.name',
        'r.is_active',
        'r.is_protected',
        'r.status',
        'r.created_at',
        'r.updated_at',
        this.knex.raw(`
        COALESCE(
          jsonb_build_object(
            'first_name', a.first_name,
            'last_name', a.last_name,
            'phone_number', a.phone_number
          ),
          '{}'::jsonb
        ) as created_by_admin
      `),
      )
      .leftJoin('admins as a', 'r.created_by', 'a.id')
      .where('r.id', id)
      .andWhere('r.status', 'Open')
      .first();

    if (!role) {
      throw new NotFoundException({
        message: 'Role not found',
        location: 'role_id',
      });
    }

    const permissions: Permission[] = await this.knex<Permission>('role_permissions as rp')
      .join('permissions as p', 'rp.permission_id', 'p.id')
      .select('p.id', 'p.name', 'p.description')
      .where('rp.role_id', id)
      .andWhere('p.status', 'Open');
    const typedRole: Role = role as Role;
    return {
      ...typedRole,
      permissions,
    };
  }

  async update(id: string, dto: UpdateRoleDto): Promise<{ message: string }> {
    return this.knex.transaction(async (trx) => {
      const role = await this.findOne(id);

      if (
        role.is_protected &&
        ((Array.isArray(dto.permission_ids) && dto.permission_ids.length > 0) ||
          dto.is_active === false)
      ) {
        throw new ForbiddenException({
          message: 'This role is system-protected and cannot be deleted or deactivated.',
          location: 'role_protected',
        });
      }

      if (dto.name && dto.name.toLowerCase() !== role.name.toLowerCase()) {
        const nameExists = await trx('roles')
          .whereRaw('LOWER(name) = ?', dto.name.toLowerCase())
          .andWhereNot({ id })
          .andWhere({ status: 'Open' })
          .first();

        if (nameExists) {
          throw new BadRequestException({
            message: 'Role name already exists',
            location: 'role_name',
          });
        }
      }

      if (Array.isArray(dto.permission_ids)) {
        const foundPermissions = await trx('permissions')
          .whereIn('id', dto.permission_ids)
          .andWhere({ is_active: true, status: 'Open' });

        if (foundPermissions.length !== dto.permission_ids.length) {
          throw new BadRequestException({
            message: 'Some permission IDs are invalid or inactive',
            location: 'permission_ids',
          });
        }

        await trx('role_permissions').where({ role_id: id }).delete();

        const mappings = dto.permission_ids.map((permission_id) => ({
          role_id: id,
          permission_id,
        }));

        if (mappings.length > 0) {
          await trx('role_permissions').insert(mappings);
        }
      }

      const updatePayload = {
        ...(dto.name && { name: dto.name }),
        ...(dto.is_active !== undefined && { is_active: dto.is_active }),
        ...(dto.status && { status: dto.status }),
        updated_at: new Date(),
      };

      await trx('roles').where({ id }).update(updatePayload);

      const adminIds = await trx('admin_roles').where({ role_id: id }).pluck('admin_id');

      await Promise.all(
        adminIds.map((adminId) => this.redisService.del(`admin:${adminId}:permissions`)),
      );

      return { message: 'Role updated successfully' };
    });
  }

  async delete(id: string): Promise<{ message: string }> {
    const role: RoleWithPermissions = await this.findOne(id);

    if (role?.is_protected) {
      throw new ForbiddenException({
        message: 'This role is system-protected and cannot be deleted or deactivated.',
        location: 'role_protected',
      });
    }
    await this.knex('roles').where({ id }).update({
      is_active: false,
      status: 'Deleted',
      updated_at: new Date(),
    });

    await this.repairOrderStatusPermissionsService.deletePermissionsByRole(id);
    return { message: 'Role deleted (soft) successfully' };
  }
}
