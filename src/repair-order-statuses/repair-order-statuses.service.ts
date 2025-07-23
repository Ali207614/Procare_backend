import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import { getNextSortValue } from 'src/common/utils/sort.util';
import { CreateRepairOrderStatusDto } from './dto/create-repair-order-status.dto';
import { UpdateRepairOrderStatusDto } from './dto/update-repair-order-status.dto';
import { RedisService } from 'src/common/redis/redis.service';
import { RepairOrderStatusPermissionsService } from 'src/repair-order-status-permission/repair-order-status-permissions.service';
import { Branch } from 'src/common/types/branch.interface';
import {
  RepairOrderStatus,
  RepairOrderStatusWithPermissions,
} from 'src/common/types/repair-order-status.interface';
import { RepairOrderStatusPermission } from 'src/common/types/repair-order-status-permssion.interface';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { RepairOrderStatusTransition } from 'src/common/types/repair-order-status-transition.interface';

@Injectable()
export class RepairOrderStatusesService {
  private readonly redisKeyView = 'status_viewable:';
  private readonly redisKeyAll = 'repair_order_statuses:all:';
  private readonly redisKeyById = 'repair_order_statuses:id';

  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly redisService: RedisService,
    private readonly repairOrderStatusPermissions: RepairOrderStatusPermissionsService,
  ) {}

  async create(dto: CreateRepairOrderStatusDto, adminId: string): Promise<RepairOrderStatus> {
    let branchId: string | undefined = dto.branch_id;
    let branch: Branch | undefined | null = null;

    if (branchId) {
      const redisKey = `branches:by_id:${branchId}`;
      branch = await this.redisService.get(redisKey);

      if (!branch) {
        branch = await this.knex<Branch>('branches')
          .where({ id: branchId, status: 'Open' })
          .first();

        if (!branch) {
          throw new BadRequestException({
            message: 'Branch not found or deleted',
            location: 'branch_id',
          });
        }

        if (!branch?.is_active) {
          throw new BadRequestException({
            message: 'Branch inactive',
            location: 'branch_id',
          });
        }

        await this.redisService.set(redisKey, branch, 3600);
      }

      branchId = branch.id;
    } else {
      const defaultBranch: Branch | undefined = await this.knex('branches')
        .select('id')
        .where({ is_protected: true, is_active: true, status: 'Open' })
        .first();

      if (!defaultBranch) {
        throw new BadRequestException({
          message: 'Default protected branch not found',
          location: 'default_branch_missing',
        });
      }

      branchId = defaultBranch.id;
    }

    const existing = await this.knex<RepairOrderStatus>('repair_order_statuses')
      .where({ branch_id: branchId })
      .andWhere((qb): void => {
        void qb
          .whereILike('name_uz', dto.name_uz)
          .orWhereILike('name_ru', dto.name_ru)
          .orWhereILike('name_en', dto.name_en);
      })
      .andWhereNot({ status: 'Deleted' })
      .first();

    if (existing) {
      throw new BadRequestException({
        message: 'Status name already exists in this branch',
        location: 'name_conflict',
      });
    }

    const nextSort = await getNextSortValue(this.knex, 'repair_order_statuses', {
      where: { branch_id: branchId },
    });

    const insertData = {
      ...dto,
      branch_id: branchId,
      sort: nextSort,
      created_by: adminId,
    };
    const inserted: RepairOrderStatus[] = await this.knex('repair_order_statuses')
      .insert(insertData)
      .returning('*');

    const created = inserted[0];

    await this.redisService.flushByPrefix(`${this.redisKeyView}${branchId}:`);
    await this.redisService.flushByPrefix(`${this.redisKeyAll}${branchId}`);

    return created;
  }

  async findAllStatuses(branchId: string): Promise<RepairOrderStatus[]> {
    const cacheKey = `${this.redisKeyAll}${branchId}`;
    const cached: RepairOrderStatus[] | null = await this.redisService.get(cacheKey);
    if (cached !== null) return cached;

    const statuses: RepairOrderStatus[] = await this.knex<RepairOrderStatus>(
      'repair_order_statuses',
    )
      .where({ branch_id: branchId, status: 'Open' })
      .orderBy('sort', 'asc');

    await this.redisService.set(cacheKey, statuses, 3600);
    return statuses;
  }

  async findViewable(
    admin: AdminPayload,
    branchId: string,
  ): Promise<RepairOrderStatusWithPermissions[]> {
    const cacheKey = `${this.redisKeyView}${branchId}:${admin.id}`;
    const cached: RepairOrderStatusWithPermissions[] | null = await this.redisService.get(cacheKey);
    if (cached !== null) return cached;

    const permissions = await this.repairOrderStatusPermissions.findByRolesAndBranch(
      admin.roles,
      branchId,
    );
    if (!permissions.length) {
      await this.redisService.set(cacheKey, [], 300);
      return [];
    }

    const viewableIds = permissions.filter((p) => p.can_view).map((p) => p.status_id);
    if (!viewableIds.length) {
      await this.redisService.set(cacheKey, [], 300);
      return [];
    }

    const statuses: RepairOrderStatus[] = await this.knex('repair_order_statuses')
      .whereIn('id', viewableIds)
      .andWhere({ is_active: true, status: 'Open', branch_id: branchId })
      .orderBy('sort', 'asc');

    const transitionsRaw: RepairOrderStatusTransition[] = await this.knex(
      'repair_order_status_transitions',
    ).whereIn('from_status_id', viewableIds);

    const transitionsMap = transitionsRaw.reduce<Record<string, string[]>>((acc, t) => {
      if (!acc[t.from_status_id]) acc[t.from_status_id] = [];
      acc[t.from_status_id].push(t.to_status_id);
      return acc;
    }, {});

    const merged: RepairOrderStatusWithPermissions[] = statuses.map((status) => {
      const matched = permissions.find((p) => p.status_id === status.id);
      return {
        ...status,
        permissions: (matched ?? {}) as RepairOrderStatusPermission,
        transitions: transitionsMap[status.id] || [],
      };
    });

    await this.redisService.set(cacheKey, merged, 3600);
    return merged;
  }

  async updateSort(status: RepairOrderStatus, newSort: number): Promise<{ message: string }> {
    const trx = await this.knex.transaction();
    try {
      const currentSort = status.sort;

      if (newSort === currentSort) {
        return { message: 'No change needed' };
      }

      if (newSort < currentSort) {
        await trx('repair_order_statuses')
          .where('branch_id', status.branch_id)
          .andWhere('sort', '>=', newSort)
          .andWhere('sort', '<', currentSort)
          .update({ sort: this.knex.raw('sort + 1') });
      } else {
        await trx('repair_order_statuses')
          .where('branch_id', status.branch_id)
          .andWhere('sort', '<=', newSort)
          .andWhere('sort', '>', currentSort)
          .update({ sort: this.knex.raw('sort - 1') });
      }

      await trx('repair_order_statuses')
        .where({ id: status.id })
        .update({ sort: newSort, updated_at: new Date() });

      await trx.commit();

      await this.redisService.flushByPrefix(`${this.redisKeyView}${status.branch_id}:`);
      await this.redisService.flushByPrefix(`${this.redisKeyAll}${status.branch_id}`);

      return { message: 'Sort updated successfully' };
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  async update(
    status: RepairOrderStatus,
    dto: UpdateRepairOrderStatusDto,
  ): Promise<{ message: string }> {
    if (dto?.is_active === false && status?.is_protected) {
      throw new ForbiddenException({
        message: 'This status is system-protected and cannot be deleted or deactivated.',
        location: 'status_protected',
      });
    }

    const branchId: string | undefined = dto.branch_id;
    let branch: Branch | undefined | null = null;

    if (branchId) {
      const redisKey = `branches:by_id:${branchId}`;
      branch = await this.redisService.get(redisKey);

      if (branch !== null) {
        branch = await this.knex<Branch>('branches')
          .where({ id: branchId, status: 'Open' })
          .first();

        if (!branch) {
          throw new BadRequestException({
            message: 'Branch not found or deleted',
            location: 'branch_id',
          });
        }

        if (!branch?.is_active) {
          throw new BadRequestException({
            message: 'Branch inactive',
            location: 'branch_id',
          });
        }

        await this.redisService.set(redisKey, branch, 3600);
      }
    }

    if (dto.name_uz || dto.name_ru || dto.name_en) {
      const conflict = await this.knex('repair_order_statuses')
        .whereNot('id', status.id)
        .andWhere((qb) => {
          if (dto.name_uz) void qb.orWhereRaw('LOWER(name_uz) = LOWER(?)', [dto.name_uz]);
          if (dto.name_ru) void qb.orWhereRaw('LOWER(name_ru) = LOWER(?)', [dto.name_ru]);
          if (dto.name_en) void qb.orWhereRaw('LOWER(name_en) = LOWER(?)', [dto.name_en]);
        })
        .first();

      if (conflict) {
        throw new BadRequestException({
          message: 'Another branch already has one of these names',
          location: 'branch_name_conflict',
        });
      }
    }

    await this.knex('repair_order_statuses')
      .where({ id: status.id })
      .update({ ...dto, updated_at: new Date() });

    const updated = await this.knex('repair_order_statuses').where({ id: status.id }).first();

    await this.redisService.set(`${this.redisKeyById}:${status.id}`, updated, 3600);
    await this.redisService.flushByPrefix(`${this.redisKeyView}${status.branch_id}:`);
    await this.redisService.flushByPrefix(`${this.redisKeyAll}${status.branch_id}`);

    return { message: 'Status updated successfully' };
  }

  async delete(status: RepairOrderStatus): Promise<{ message: string }> {
    if (status?.is_protected) {
      throw new ForbiddenException({
        message: 'This status is system-protected and cannot be deleted or deactivated.',
        location: 'status_protected',
      });
    }

    await this.knex('repair_order_statuses')
      .where({ id: status.id })
      .update({ status: 'Deleted', updated_at: new Date() });

    await this.repairOrderStatusPermissions.deletePermissionsByStatus(status.id);

    await this.redisService.del(`${this.redisKeyById}:${status.id}`);
    await this.redisService.flushByPrefix(`${this.redisKeyView}${status.branch_id}:`);
    await this.redisService.flushByPrefix(`${this.redisKeyAll}${status.branch_id}`);

    return { message: 'Status deleted successfully' };
  }

  async getOrLoadStatusById(statusId: string): Promise<RepairOrderStatus> {
    const redisKey = `${this.redisKeyById}:${statusId}`;
    let status: RepairOrderStatus | null = await this.redisService.get(redisKey);

    if (status === null) {
      status = await this.knex('repair_order_statuses')
        .where({ id: statusId, status: 'Open' })
        .first();

      if (!status) {
        throw new BadRequestException({
          message: 'Repair order status not found or inactive',
          location: 'from_status_id',
        });
      }

      await this.redisService.set(redisKey, status, 3600);
    }

    return status;
  }
}
