import { Injectable } from '@nestjs/common';
import { InjectKnex, Knex } from 'nestjs-knex';
import { RedisService } from 'src/common/redis/redis.service';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly redisService: RedisService,
  ) {}

  private getCacheKey(adminId: string): string {
    return `admin:${adminId}:permissions`;
  }

  async getPermissions(adminId: string): Promise<string[]> {
    const start = Date.now();

    const cacheKey = this.getCacheKey(adminId);
    const cached = await this.redisService.get<string[]>(cacheKey);
    if (cached !== null) {
      const duration = Date.now() - start;
      console.log(`🛠 Permissions: (${duration}ms) redis`);
      return cached;
    }

    const permissions = await this.loadPermissionsFromDB(adminId);
    await this.redisService.set(cacheKey, permissions, 300); // 5 min cache
    const duration = Date.now() - start;
    console.log(`🛠 Permissions: (${duration}ms) knex`);
    return permissions;
  }

  private async loadPermissionsFromDB(adminId: string): Promise<string[]> {
    const rows = await this.knex('admin_roles as ar')
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

    return rows.map((row) => row.name);
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
  }) {
    const { search, limit = 20, offset = 0, sort_by = 'created_at', sort_order = 'desc' } = query;

    const qb = this.knex('permissions').where('is_active', true).andWhere('status', 'Open');

    if (search) {
      qb.andWhere((builder) =>
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
