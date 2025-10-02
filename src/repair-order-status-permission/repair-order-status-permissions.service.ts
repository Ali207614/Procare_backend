import { BadRequestException, ForbiddenException, HttpException, Injectable } from '@nestjs/common';
import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import { RedisService } from 'src/common/redis/redis.service';
import { AssignRepairOrderStatusPermissionsDto } from 'src/repair-order-status-permission/dto/create-repair-order-status-permission.dto';
import { RepairOrderStatusPermission } from 'src/common/types/repair-order-status-permssion.interface';
import { RepairOrderStatus } from 'src/common/types/repair-order-status.interface';
import { LoggerService } from 'src/common/logger/logger.service';

@Injectable()
export class RepairOrderStatusPermissionsService {
  private readonly redisKeyByRoleStatus = 'repair_order_status_role_permissions:by_role_status';
  private readonly redisKeyByRoleBranch = 'repair_order_status_role_permissions:by_role_branch';
  private readonly table: string = 'repair_order_status_permissions';
  private readonly redisKeyView = 'status_viewable:';

  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly redisService: RedisService,
    private readonly logger: LoggerService,
  ) {}

  async createManyByRole(
    dto: AssignRepairOrderStatusPermissionsDto,
  ): Promise<{ message: string; count: number }> {
    const { branch_id, role_id, status_ids, ...permissions } = dto;

    const trx = await this.knex.transaction();

    try {
      const [role] = await trx('roles').where({ id: role_id, status: 'Open' });
      if (!role) {
        throw new BadRequestException({
          message: 'Role not found or deleted',
          location: 'role_id',
        });
      }

      const validStatuses: RepairOrderStatus[] = await trx('repair_order_statuses')
        .whereIn('id', status_ids)
        .andWhere({ branch_id, status: 'Open' });

      if (validStatuses.length !== status_ids.length) {
        const validIds = validStatuses.map((s) => s.id);
        const invalidIds = status_ids.filter((id) => !validIds.includes(id));
        throw new BadRequestException({
          message: 'Some statuses not found or not assigned to the specified branch',
          location: 'status_ids',
          invalid_ids: invalidIds,
        });
      }

      await trx(this.table).where({ branch_id, role_id }).whereIn('status_id', status_ids).del();

      const now = new Date().toISOString();
      const inserts = status_ids.map((status_id) => ({
        branch_id,
        role_id,
        status_id,
        ...permissions,
        created_at: now,
        updated_at: now,
      }));

      const inserted: RepairOrderStatusPermission[] = await trx(this.table)
        .insert(inserts)
        .returning('*');

      await trx.commit();

      await Promise.all(inserted.map((row) => this.flushAndReloadCacheByRole(row)));
      await this.redisService.flushByPrefix(`${this.redisKeyView}${branch_id}:`);

      return {
        message: 'Permissions assigned successfully to selected role and statuses',
        count: inserted.length,
      };
    } catch (error) {
      await trx.rollback();
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Failed to assign permissions by role: `);
      throw new BadRequestException({
        message: 'Failed to assign permissions',
        location: 'assign_permissions',
      });
    }
  }

  async findByStatusId(statusId: string): Promise<RepairOrderStatusPermission[]> {
    return this.knex<RepairOrderStatusPermission>(this.table)
      .join('branches', `${this.table}.branch_id`, 'branches.id')
      .join('roles', `${this.table}.role_id`, 'roles.id')
      .join('repair_order_statuses', `${this.table}.status_id`, 'repair_order_statuses.id')
      .where(`${this.table}.status_id`, statusId)
      .andWhere('branches.status', 'Open')
      .andWhere('roles.status', 'Open')
      .andWhere('repair_order_statuses.status', 'Open')
      .select(`${this.table}.*`)
      .orderBy(`${this.table}.created_at`, 'desc');
  }

  async findByRoleStatus(
    roleId: string,
    statusId: string,
  ): Promise<RepairOrderStatusPermission | null> {
    const key = `${this.redisKeyByRoleStatus}:${roleId}:${statusId}`;
    const cached: RepairOrderStatusPermission | null =
      await this.redisService.get<RepairOrderStatusPermission>(key);
    if (cached !== null) return cached;

    const permission = (await this.knex(this.table)
      .join('branches', `${this.table}.branch_id`, 'branches.id')
      .join('roles', `${this.table}.role_id`, 'roles.id')
      .join('repair_order_statuses', `${this.table}.status_id`, 'repair_order_statuses.id')
      .where(`${this.table}.role_id`, roleId)
      .andWhere(`${this.table}.status_id`, statusId)
      .andWhere('branches.status', 'Open')
      .andWhere('roles.status', 'Open')
      .andWhere('repair_order_statuses.status', 'Open')
      .select(`${this.table}.*`)
      .first()) as RepairOrderStatusPermission | undefined;

    await this.redisService.set(key, permission ?? null, 3600);

    return permission ?? null;
  }

  async findByRolesAndBranch(
    roles: { name: string; id: string }[],
    branchId: string,
  ): Promise<RepairOrderStatusPermission[]> {
    try {
      const roleIds = roles.map((role) => role.id);
      if (!roleIds.length) {
        return [];
      }

      const keys: string[] = roleIds.map(
        (roleId: string): string => `${this.redisKeyByRoleBranch}:${roleId}:${branchId}`,
      );
      const cachedResults = await Promise.all(
        keys.map((key) => this.redisService.get<RepairOrderStatusPermission[]>(key)),
      );

      const found: RepairOrderStatusPermission[] = cachedResults
        .flat()
        .filter(Boolean) as RepairOrderStatusPermission[];
      const missingRoleIds: string[] = roleIds.filter(
        (_, idx: number): boolean => cachedResults[idx] === null,
      );
      if (missingRoleIds.length === 0) return found;

      const missingPermissions: RepairOrderStatusPermission[] =
        await this.knex<RepairOrderStatusPermission>(this.table)
          .join('branches', `${this.table}.branch_id`, 'branches.id')
          .join('roles', `${this.table}.role_id`, 'roles.id')
          .join('repair_order_statuses', `${this.table}.status_id`, 'repair_order_statuses.id')
          .whereIn(`${this.table}.role_id`, missingRoleIds)
          .andWhere(`${this.table}.branch_id`, branchId)
          .andWhere('branches.status', 'Open')
          .andWhere('roles.status', 'Open')
          .andWhere('repair_order_statuses.status', 'Open')
          .select(`${this.table}.*`);

      await Promise.all(
        missingRoleIds.map((roleId) => {
          const perRole = missingPermissions.filter((p) => p.role_id === roleId);
          const key = `${this.redisKeyByRoleBranch}:${roleId}:${branchId}`;
          return this.redisService.set(key, perRole, 3600);
        }),
      );

      return [...found, ...missingPermissions];
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Failed to fetch permissions by roles and branch: `);
      throw new BadRequestException({
        message: 'Failed to fetch permissions',
        location: 'fetch_permissions',
      });
    }
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
    roleIds: { name: string; id: string }[],
    branchId: string,
    statusId: string,
    requiredFields: (keyof RepairOrderStatusPermission)[],
    location: string,
    permissions: RepairOrderStatusPermission[],
  ): Promise<void> {
    let allPermissions: RepairOrderStatusPermission[] = [];
    if (!permissions?.length) {
      allPermissions = await this.findByRolesAndBranch(roleIds, branchId);
    } else {
      allPermissions = permissions;
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

  async deletePermissionsByRole(roleId: string): Promise<void> {
    const permissions: RepairOrderStatusPermission[] = await this.knex(this.table).where({
      role_id: roleId,
    });

    if (permissions.length === 0) return;

    await this.knex(this.table).where({ role_id: roleId }).del();

    await Promise.all(
      permissions.map(
        (permission: RepairOrderStatusPermission): Promise<void> =>
          this.flushAndReloadCacheByRole(permission),
      ),
    );
  }

  async deletePermissionsByBranch(branchId: string): Promise<void> {
    const permissions: RepairOrderStatusPermission[] = await this.knex(this.table).where({
      branch_id: branchId,
    });

    if (permissions.length === 0) return;

    await this.knex(this.table).where({ branch_id: branchId }).del();

    await Promise.all(
      permissions.map(
        (permission: RepairOrderStatusPermission): Promise<void> =>
          this.flushAndReloadCacheByRole(permission),
      ),
    );
  }

  async deletePermissionsByStatus(statusId: string): Promise<void> {
    const permissions: RepairOrderStatusPermission[] = await this.knex(this.table).where({
      status_id: statusId,
    });

    if (permissions.length === 0) return;

    await this.knex(this.table).where({ status_id: statusId }).del();

    await Promise.all(
      permissions.map(
        (permission: RepairOrderStatusPermission): Promise<void> =>
          this.flushAndReloadCacheByRole(permission),
      ),
    );
  }
}
