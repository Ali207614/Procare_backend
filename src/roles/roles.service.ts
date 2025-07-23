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
    const existing = await this.knex('roles')
      .whereRaw('LOWER(name) = ?', dto.name.toLowerCase())
      .andWhere({ status: 'Open' })
      .first();

    if (existing) {
      throw new BadRequestException({
        message: 'Role name already exists',
        location: 'role_name',
      });
    }

    if (dto.permission_ids?.length) {
      const foundPermissions: Permission[] = await this.knex('permissions')
        .whereIn('id', dto.permission_ids)
        .andWhere({ is_active: true, status: 'Open' });

      if (foundPermissions.length !== dto.permission_ids.length) {
        throw new BadRequestException({
          message: 'Some permission IDs are invalid or inactive',
          location: 'permission_ids',
        });
      }
    }

    const [role]: Role[] = await this.knex('roles')
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

      await this.knex('role_permissions').insert(mappings);
    }

    return role;
  }

  async findAll(): Promise<Role[]> {
    return this.knex('roles').where({ status: 'Open' });
  }

  async findOne(id: string): Promise<RoleWithPermissions> {
    const role: Role | undefined = await this.knex('roles').where({ id, status: 'Open' }).first();

    if (!role) {
      throw new NotFoundException({
        message: 'Role not found',
        location: 'role_not_found',
      });
    }

    const permissions = await this.knex('role_permissions as rp')
      .join('permissions as p', 'rp.permission_id', 'p.id')
      .select('p.id', 'p.name')
      .where('rp.role_id', id)
      .andWhere('p.status', 'Open');

    return {
      ...role,
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
