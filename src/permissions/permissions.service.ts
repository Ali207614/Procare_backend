import { Injectable } from '@nestjs/common';
import { InjectKnex } from 'nestjs-knex';
import { RedisService } from 'src/common/redis/redis.service';
import { Knex } from 'knex';
import { Permission } from 'src/common/types/permission.interface';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly redisService: RedisService,
  ) {}

  private getCacheKey(adminId: string): string {
    return `admin:${adminId}:permissions`;
  }

  /**
   * Retrieves permissions for a given admin ID.
   * Caches the result in Redis for 5 minutes.
   * If cached, returns the cached permissions.
   * If not cached, queries the database and caches the result.
   *
   * @param adminId - The ID of the admin to retrieve permissions for.
   * @returns A promise that resolves to an array of permission names.
   */
  async getPermissions(adminId: string): Promise<string[]> {
    const start = Date.now();

    const cacheKey = this.getCacheKey(adminId);
    const cached: string[] | null = await this.redisService.get(cacheKey);
    if (cached !== null) {
      const duration = Date.now() - start;
      console.log(`🛠 Permissions: (${duration}ms) redis`);
      return cached;
    }

    const permissions: string[] = await this.loadPermissionsFromDB(adminId);
    await this.redisService.set(cacheKey, permissions, 300); // 5 min cache
    const duration = Date.now() - start;
    console.log(`🛠 Permissions: (${duration}ms) knex`);
    return permissions;
  }

  private async loadPermissionsFromDB(adminId: string): Promise<string[]> {
    const rows = await this.knex<Permission>('admin_roles as ar')
      .join('roles as r', 'r.id', 'ar.role_id')
      .join('role_permissions as rp', 'rp.role_id', 'r.id')
      .join('permissions as p', 'p.id', 'rp.permission_id')
      .where('ar.admin_id', adminId)
      .andWhere('r.is_active', true)
      .andWhere('r.status', 'Open')
      .andWhere('p.is_active', true)
      .andWhere('p.status', 'Open')
      .select('p.name')
      .groupBy('p.name');

    return rows.map((row) => row.name as string);
  }

  async clearPermissionCache(adminId: string): Promise<void> {
    const cacheKey = this.getCacheKey(adminId);
    await this.redisService.del(cacheKey);
  }

  async findAll(query: {
    search?: string;
    limit?: number;
    offset?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }): Promise<Permission[]> {
    const { search, limit = 20, offset = 0, sort_by = 'created_at', sort_order = 'desc' } = query;

    const qb = this.knex<Permission>('permissions')
      .where('is_active', true)
      .andWhere('status', 'Open');

    if (search) {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      void qb.andWhere((builder: Knex.QueryBuilder) =>
        builder.whereILike('name', `%${search}%`).orWhereILike('description', `%${search}%`),
      );
    }

    return qb
      .orderBy(sort_by, sort_order)
      .limit(limit)
      .offset(offset)
      .select('id', 'name', 'description', 'created_at');
  }
}
