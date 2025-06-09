import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectKnex, Knex } from 'nestjs-knex';
import { RedisService } from 'src/common/redis/redis.service';
import { CreateRoleDto } from './dto/create-role.dto';

@Injectable()
export class RolesService {
    constructor(
        @InjectKnex() private readonly knex: Knex,
        private readonly redisService: RedisService,
    ) { }

    private getCacheKey(userId: string) {
        return `user:${userId}:roles`;
    }

    async getRolesByUserId(userId: string): Promise<string[]> {
        const cacheKey = this.getCacheKey(userId);

        const cachedRoles: any = await this.redisService.get(cacheKey);
        if (cachedRoles && cachedRoles?.length) {
            return cachedRoles;
        }

        const rows = await this.knex('user_roles')
            .select('roles.name')
            .join('roles', 'roles.id', 'user_roles.role_id')
            .where('user_roles.user_id', userId);

        const roles: any = rows.map(row => row.name);

        await this.redisService.set(cacheKey, roles, 300);

        return roles;
    }

    async clearUserRolesCache(userId: string): Promise<void> {
        const cacheKey = this.getCacheKey(userId);
        await this.redisService.del(cacheKey);
    }

    async createRole(dto: CreateRoleDto) {
        const [created] = await this.knex('roles')
            .insert({ name: dto.name, description: dto.description })
            .returning('*');
        return created;
    }

    async deleteRole(id: string) {
        const deleted = await this.knex('roles')
            .where({ id })
            .del();

        if (!deleted) {
            throw new NotFoundException('Role not found');
        }

        return { success: true };
    }
}
