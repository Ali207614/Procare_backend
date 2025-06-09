import { Injectable } from '@nestjs/common';
import { InjectKnex, Knex } from 'nestjs-knex';
import { RedisService } from 'src/common/redis/redis.service';

@Injectable()
export class PermissionsService {
    constructor(
        @InjectKnex() private readonly knex: Knex,
        private readonly redisService: RedisService,
    ) { }

    private getCacheKey(userId: string) {
        return `user:${userId}:permissions`;
    }

    async getPermissions(userId: string): Promise<string[]> {
        const cacheKey = this.getCacheKey(userId);
        const redis = this.redisService.getClient();

        const cachedPermissions: any = await redis.get(cacheKey);
        if (cachedPermissions) {
            return cachedPermissions;
        }

        const permissions = await this.loadPermissionsFromDB(userId);

        await redis.set(cacheKey, JSON.stringify(permissions), { EX: 300 });
        return permissions;
    }

    private async loadPermissionsFromDB(userId: string): Promise<string[]> {
        const rows = await this.knex('user_roles as ur')
            .join('role_permissions as rp', 'rp.role_id', 'ur.role_id')
            .join('permissions as p', 'p.id', 'rp.permission_id')
            .where('ur.user_id', userId)
            .select('p.name')
            .groupBy('p.name');

        return rows.map(row => row.name);
    }

    async clearPermissionCache(userId: string) {
        const cacheKey = this.getCacheKey(userId);
        const redis = this.redisService.getClient();
        await redis.del(cacheKey);
    }
}
