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

@Injectable()
export class RolesService {
  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly redisService: RedisService,
  ) {}

  async create(dto: CreateRoleDto, adminId: string) {
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
      const foundPermissions = await this.knex('permissions')
        .whereIn('id', dto.permission_ids)
        .andWhere({ is_active: true, status: 'Open' });

      if (foundPermissions.length !== dto.permission_ids.length) {
        throw new BadRequestException({
          message: 'Some permission IDs are invalid or inactive',
          location: 'permission_ids',
        });
      }
    }

    const [role] = await this.knex('roles')
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

  async findAll() {
    return this.knex('roles').where({ status: 'Open' });
  }

  async findOne(id: string) {
    const role = await this.knex('roles')
      .where({
        id,
        status: 'Open',
      })
      .first();
    if (!role) {
      throw new NotFoundException({
        message: 'Role not found',
        location: 'role_not_found',
      });
    }
    return role;
  }

  async update(id: string, dto: UpdateRoleDto) {
    return await this.knex.transaction(async (trx) => {
      const role = await this.findOne(id);

      if (
        role?.is_protected &&
        ((Array.isArray(dto.permission_ids) && dto.permission_ids.length > 0) ||
          dto?.is_active === false)
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

      if (Array.isArray(dto.permission_ids) && dto.permission_ids.length > 0) {
        const foundPermissions = await trx('permissions')
          .whereIn('id', dto.permission_ids)
          .andWhere({ is_active: true, status: 'Open' });

        if (foundPermissions.length !== dto.permission_ids.length) {
          throw new BadRequestException({
            message: 'Some permission IDs are invalid or inactive',
            location: 'permission_ids',
          });
        }

        await trx('role_permissions').where({ role_id: id }).del();

        const mappings = dto.permission_ids.map((permission_id) => ({
          role_id: id,
          permission_id,
        }));

        await trx('role_permissions').insert(mappings);
      }

      await trx('roles')
        .where({ id })
        .update({
          ...(dto.name && { name: dto.name }),
          ...(dto.is_active !== undefined && { is_active: dto.is_active }),
          ...(dto.status && { status: dto.status }),
          updated_at: new Date(),
        });

      const adminIds = await trx('admin_roles').where({ role_id: id }).pluck('admin_id');

      await Promise.all(
        adminIds.map((adminId) => this.redisService.del(`admin:${adminId}:permissions`)),
      );

      return { message: 'Role updated successfully' };
    });
  }

  async delete(id: string) {
    const role = await this.findOne(id);

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
    return { message: 'Role deleted (soft) successfully' };
  }
}
