import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import { AssignRepairOrderStatusPermissionsDto } from './dto/create-repair-order-status-permission.dto';
import { RedisService } from 'src/common/redis/redis.service';
import { RepairOrderStatusPermission } from 'src/common/types/repair-order-status-permssion.interface';

@Injectable()
export class RepairOrderStatusPermissionsService {
  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly redisService: RedisService,
  ) {}

  private readonly redisKeyByAdminStatus = 'repair_order_status_permissions:by_admin_status';
  private readonly redisKeyByAdminBranch = 'repair_order_status_permissions:by_admin_branch';

  async createMany(
    dto: AssignRepairOrderStatusPermissionsDto,
  ): Promise<{ message: string; count: number }> {
    const { branch_id, status_ids, admin_ids, ...permissions } = dto;

    const trx = await this.knex.transaction();

    try {
      await trx('repair_order_status_permissions')
        .where({ branch_id })
        .whereIn('admin_id', admin_ids)
        .whereIn('status_id', status_ids)
        .del();

      const inserts = [];

      for (const admin_id of admin_ids) {
        for (const status_id of status_ids) {
          inserts.push({
            admin_id,
            status_id,
            branch_id,
            ...permissions,
            created_at: new Date(),
            updated_at: new Date(),
          });
        }
      }

      const inserted: RepairOrderStatusPermission[] = await trx('repair_order_status_permissions')
        .insert(inserts)
        .returning('*');

      await trx.commit();

      await Promise.all(
        inserted.map(
          (row: RepairOrderStatusPermission): Promise<void> => this.flushAndReloadCache(row),
        ),
      );

      return {
        message: 'Permissions assigned successfully to selected admins and statuses',
        count: inserted.length,
      };
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  async findByStatusId(statusId: string): Promise<RepairOrderStatusPermission[]> {
    return this.knex('repair_order_status_permissions')
      .where({ status_id: statusId })
      .orderBy('created_at', 'desc');
  }

  async findByAdminStatus(
    adminId: string,
    statusId: string,
  ): Promise<RepairOrderStatusPermission | null> {
    const key = `${this.redisKeyByAdminStatus}:${adminId}:${statusId}`;
    const cached: RepairOrderStatusPermission | null = await this.redisService.get(key);

    if (cached !== null) return cached;
    const permission: RepairOrderStatusPermission | undefined =
      await this.knex<RepairOrderStatusPermission>('repair_order_status_permissions')
        .where({ admin_id: adminId, status_id: statusId })
        .first();

    await this.redisService.set(key, permission, 3600);
    return permission ?? null;
  }

  async findByAdminBranch(
    adminId: string,
    branchId: string,
  ): Promise<RepairOrderStatusPermission[]> {
    const key = `${this.redisKeyByAdminBranch}:${adminId}:${branchId}`;
    const cached: RepairOrderStatusPermission[] | null = await this.redisService.get(key);

    if (cached !== null) return cached ?? [];

    const permissions: RepairOrderStatusPermission[] = await this.knex<RepairOrderStatusPermission>(
      'repair_order_status_permissions',
    ).where({
      admin_id: adminId,
      branch_id: branchId,
    });

    if (!permissions.length) {
      await this.redisService.set(key, [], 3600);
      return [];
    }
    return permissions;
  }

  private async flushAndReloadCache(permission: RepairOrderStatusPermission): Promise<void> {
    const { admin_id, status_id, branch_id } = permission;

    const keyByStatus = `${this.redisKeyByAdminStatus}:${admin_id}:${status_id}`;
    const keyByBranch = `${this.redisKeyByAdminBranch}:${admin_id}:${branch_id}`;

    await Promise.all([this.redisService.del(keyByStatus), this.redisService.del(keyByBranch)]);

    const [statusPermission, branchPermissions] = await Promise.all([
      this.knex('repair_order_status_permissions').where({ admin_id, status_id }).first(),
      this.knex('repair_order_status_permissions').where({ admin_id, branch_id }),
    ]);

    await Promise.all([
      this.redisService.set(keyByStatus, statusPermission, 3600),
      this.redisService.set(keyByBranch, branchPermissions, 3600),
    ]);
  }

  async flushPermissionCacheOnly(permission: RepairOrderStatusPermission): Promise<void> {
    const { admin_id, status_id, branch_id } = permission;

    const keyByStatus = `${this.redisKeyByAdminStatus}:${admin_id}:${status_id}`;
    const keyByBranch = `${this.redisKeyByAdminBranch}:${admin_id}:${branch_id}`;

    await Promise.all([this.redisService.del(keyByStatus), this.redisService.del(keyByBranch)]);
  }

  async validatePermissionOrThrow(
    adminId: string,
    statusId: string,
    permissionField: keyof RepairOrderStatusPermission,
    location: string,
  ): Promise<void> {
    const permission: RepairOrderStatusPermission | undefined | null = await this.findByAdminStatus(
      adminId,
      statusId,
    );

    if (!permission?.[permissionField]) {
      throw new ForbiddenException({
        message: `You do not have permission: ${permissionField}`,
        location,
      });
    }
  }
}
