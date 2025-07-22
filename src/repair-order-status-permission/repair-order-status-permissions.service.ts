import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import { RedisService } from 'src/common/redis/redis.service';
import { AssignRepairOrderStatusPermissionsDto } from 'src/repair-order-status-permission/dto/create-repair-order-status-permission.dto';
import { RepairOrderStatusPermission } from 'src/common/types/repair-order-status-permssion.interface';

@Injectable()
export class RepairOrderStatusPermissionsService {
  private readonly redisKeyByRoleStatus = 'repair_order_status_role_permissions:by_role_status';
  private readonly redisKeyByRoleBranch = 'repair_order_status_role_permissions:by_role_branch';
  private readonly table: string = 'repair_order_status_permissions';
  private readonly redisKeyView = 'status_viewable:';

  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly redisService: RedisService,
  ) {}

  async createManyByRole(
    dto: AssignRepairOrderStatusPermissionsDto,
  ): Promise<{ message: string; count: number }> {
    const { branch_id, status_ids, role_ids, ...permissions } = dto;

    const trx = await this.knex.transaction();

    try {
      await trx(this.table)
        .where({ branch_id })
        .whereIn('role_id', role_ids)
        .whereIn('status_id', status_ids)
        .del();

      const inserts = [];

      for (const role_id of role_ids) {
        for (const status_id of status_ids) {
          inserts.push({
            role_id,
            status_id,
            branch_id,
            ...permissions,
            created_at: new Date().toISOString() || '',
            updated_at: new Date().toISOString() || '',
          });
        }
      }

      const inserted: RepairOrderStatusPermission[] = await trx<RepairOrderStatusPermission>(
        this.table,
      )
        .insert(inserts)
        .returning('*');

      await trx.commit();

      await Promise.all(inserted.map((row) => this.flushAndReloadCacheByRole(row)));
      await this.redisService.flushByPrefix(`${this.redisKeyView}${branch_id}:`);

      return {
        message: 'Permissions assigned successfully to selected roles and statuses',
        count: inserted.length,
      };
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  async findByStatusId(statusId: string): Promise<RepairOrderStatusPermission[]> {
    return this.knex<RepairOrderStatusPermission>(this.table)
      .where({ status_id: statusId })
      .orderBy('created_at', 'desc');
  }

  async findByRoleStatus(
    roleId: string,
    statusId: string,
  ): Promise<RepairOrderStatusPermission | null> {
    const key = `${this.redisKeyByRoleStatus}:${roleId}:${statusId}`;
    const cached = await this.redisService.get<RepairOrderStatusPermission>(key);

    if (cached !== null) return cached;

    const permission = await this.knex<RepairOrderStatusPermission>(this.table)
      .where({ role_id: roleId, status_id: statusId })
      .first();

    await this.redisService.set(key, permission ?? null, 3600);

    return permission ?? null;
  }

  async findByRolesAndBranch(
    roles: string[],
    branchId: string,
  ): Promise<RepairOrderStatusPermission[]> {
    const keys = roles.map((roleId) => `${this.redisKeyByRoleBranch}:${roleId}:${branchId}`);

    const cachedResults = await Promise.all(
      keys.map((key) => this.redisService.get<RepairOrderStatusPermission[]>(key)),
    );

    const found: RepairOrderStatusPermission[] = cachedResults
      .flat()
      .filter(Boolean) as RepairOrderStatusPermission[];

    const missingRoles = roles.filter((_, idx) => cachedResults[idx] === null);

    if (missingRoles.length === 0) {
      return found;
    }

    const missingPermissions = await this.knex<RepairOrderStatusPermission>(this.table)
      .whereIn('role_id', missingRoles)
      .andWhere('branch_id', branchId);

    await Promise.all(
      missingRoles.map((roleId) => {
        const perRole = missingPermissions.filter((p) => p.role_id === roleId);
        const key = `${this.redisKeyByRoleBranch}:${roleId}:${branchId}`;
        return this.redisService.set(key, perRole, 3600);
      }),
    );

    return [...found, ...missingPermissions];
  }

  async flushAndReloadCacheByRole(permission: RepairOrderStatusPermission): Promise<void> {
    const { role_id, status_id, branch_id } = permission;

    const keyByStatus = `${this.redisKeyByRoleStatus}:${role_id}:${status_id}`;
    const keyByBranch = `${this.redisKeyByRoleBranch}:${role_id}:${branch_id}`;

    await Promise.all([this.redisService.del(keyByStatus), this.redisService.del(keyByBranch)]);

    const [statusPermission, branchPermissions] = await Promise.all([
      this.knex<RepairOrderStatusPermission>(this.table).where({ role_id, status_id }).first(),
      this.knex<RepairOrderStatusPermission>(this.table).where({
        role_id,
        branch_id,
      }),
    ]);

    await Promise.all([
      this.redisService.set(keyByStatus, statusPermission ?? null, 3600),
      this.redisService.set(keyByBranch, branchPermissions, 3600),
    ]);
  }

  async checkPermissionsOrThrow(
    roleIds: string[],
    branchId: string,
    statusId: string,
    requiredFields: (keyof RepairOrderStatusPermission)[],
    location: string,
    permissions: RepairOrderStatusPermission[],
  ): Promise<void> {
    let allPermissions: RepairOrderStatusPermission[] = [];
    if (!permissions?.length) {
      allPermissions = await this.findByRolesAndBranch(roleIds, branchId);
    }

    const matched: RepairOrderStatusPermission | undefined = allPermissions.find(
      (perm: RepairOrderStatusPermission): boolean => perm.status_id === statusId,
    );

    if (!matched) {
      throw new ForbiddenException({
        message: 'No permission record found for the current status.',
        location,
      });
    }

    for (const field of requiredFields) {
      if (!matched[field]) {
        throw new ForbiddenException({
          message: `Permission denied: ${field}`,
          location,
        });
      }
    }
  }
}
