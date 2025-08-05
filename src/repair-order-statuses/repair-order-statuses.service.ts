import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import { getNextSortValue } from 'src/common/utils/sort.util';
import { CreateRepairOrderStatusDto } from './dto/create-repair-order-status.dto';
import { UpdateRepairOrderStatusDto } from './dto/update-repair-order-status.dto';
import { RedisService } from 'src/common/redis/redis.service';
import { RepairOrderStatusPermissionsService } from 'src/repair-order-status-permission/repair-order-status-permissions.service';
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { LoggerService } from 'src/common/logger/logger.service';
import {
  RepairOrderStatus,
  RepairOrderStatusWithPermissions,
} from 'src/common/types/repair-order-status.interface';
import { Branch } from 'src/common/types/branch.interface';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { RepairOrderStatusPermission } from 'src/common/types/repair-order-status-permssion.interface';
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
    private readonly logger: LoggerService,
  ) {}

  async create(dto: CreateRepairOrderStatusDto, adminId: string): Promise<RepairOrderStatus> {
    const trx = await this.knex.transaction();
    try {
      this.logger.log(`Creating repair order status by admin ${adminId}`);
      let branchId = dto.branch_id;
      let branch: Branch | undefined;

      if (branchId) {
        const redisKey = `branches:by_id:${branchId}`;
        branch =
          (await this.redisService.get(redisKey)) ??
          (await trx<Branch>('branches').where({ id: branchId, status: 'Open' }).first());
        if (!branch)
          throw new BadRequestException({
            message: 'Branch not found or deleted',
            location: 'branch_id',
          });
        if (!branch.is_active)
          throw new BadRequestException({ message: 'Branch inactive', location: 'branch_id' });
        await this.redisService.set(redisKey, branch, 3600);
      } else {
        branch = await trx('branches')
          .where({ is_protected: true, is_active: true, status: 'Open' })
          .first();
        if (!branch)
          throw new BadRequestException({
            message: 'Default protected branch not found',
            location: 'default_branch_missing',
          });
        branchId = branch.id;
      }

      const existing = await trx<RepairOrderStatus>('repair_order_statuses')
        .where({ branch_id: branchId })
        .andWhere(
          (qb: Knex.QueryBuilder) =>
            void qb
              .whereILike('name_uz', dto.name_uz)
              .orWhereILike('name_ru', dto.name_ru)
              .orWhereILike('name_en', dto.name_en),
        )
        .andWhereNot({ status: 'Deleted' })
        .first();
      if (existing)
        throw new BadRequestException({
          message: 'Status name already exists in this branch',
          location: 'name_conflict',
        });

      const nextSort = await getNextSortValue(trx, 'repair_order_statuses', {
        where: { branch_id: branchId },
      });
      const insertData: Partial<RepairOrderStatus> = {
        name_uz: dto.name_uz,
        name_ru: dto.name_ru,
        name_en: dto.name_en,
        branch_id: branchId,
        is_active: dto.is_active ?? true,
        can_user_view: dto.can_user_view ?? true,
        sort: nextSort,
        created_by: adminId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const [created]: RepairOrderStatus[] = await trx('repair_order_statuses')
        .insert(insertData)
        .returning('*');
      await trx.commit();

      await Promise.all([
        this.redisService.flushByPrefix(`${this.redisKeyView}${branchId}:`),
        this.redisService.flushByPrefix(`${this.redisKeyAll}${branchId}`),
        this.redisService.set(`${this.redisKeyById}:${created.id}`, created, 3600),
      ]);
      this.logger.log(`Created repair order status ${created.id}`);
      return created;
    } catch (err) {
      await trx.rollback();
      this.logger.error(`Failed to create status:`);
      throw new BadRequestException({
        message: 'Failed to create status',
        location: 'create_status',
      });
    }
  }

  async findAllStatuses(branchId: string): Promise<RepairOrderStatus[]> {
    const cacheKey = `${this.redisKeyAll}${branchId}`;
    const cached: RepairOrderStatus[] | null = await this.redisService.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for statuses: ${cacheKey}`);
      return cached;
    }

    const statuses: RepairOrderStatus[] = await this.knex<RepairOrderStatus>(
      'repair_order_statuses',
    )
      .where({ branch_id: branchId, status: 'Open' })
      .orderBy('sort', 'asc');
    await this.redisService.set(cacheKey, statuses, 3600);
    this.logger.log(`Fetched ${statuses.length} statuses for branch ${branchId}`);
    return statuses;
  }

  async findViewable(
    admin: AdminPayload,
    branchId: string,
  ): Promise<RepairOrderStatusWithPermissions[]> {
    const cacheKey = `${this.redisKeyView}${branchId}:${admin.id}`;
    const cached: RepairOrderStatusWithPermissions[] | null = await this.redisService.get(cacheKey);
    if (cached !== null) {
      return cached;
    }
    const permissions: RepairOrderStatusPermission[] =
      await this.repairOrderStatusPermissions.findByRolesAndBranch(admin.roles, branchId);

    console.log(permissions, ' bu permssions');
    const viewableIds = permissions.filter((p) => p.can_view).map((p) => p?.status_id);
    if (!viewableIds.length) {
      await this.redisService.set(cacheKey, [], 300);
      return [];
    }

    const trx = await this.knex.transaction();
    try {
      const statuses: RepairOrderStatus[] = await trx('repair_order_statuses')
        .whereIn('id', viewableIds)
        .andWhere({ is_active: true, status: 'Open', branch_id: branchId })
        .orderBy('sort', 'asc');

      const transitionsRaw: RepairOrderStatusTransition[] = await trx(
        'repair_order_status_transitions',
      ).whereIn('from_status_id', viewableIds);
      const transitionsMap = transitionsRaw.reduce<Record<string, string[]>>((acc, t) => {
        acc[t.from_status_id] = acc[t.from_status_id] || [];
        acc[t.from_status_id].push(t.to_status_id);
        return acc;
      }, {});

      const merged: RepairOrderStatusWithPermissions[] = statuses.map(
        (status: RepairOrderStatus): RepairOrderStatusWithPermissions => ({
          ...status,
          permissions:
            permissions.find((p) => p.status_id === status.id) ??
            ({} as RepairOrderStatusPermission),
          transitions: transitionsMap[status.id] || [],
        }),
      );

      await trx.commit();
      await this.redisService.set(cacheKey, merged, 3600);
      return merged;
    } catch (err) {
      await trx.rollback();
      this.logger.error(`Failed to fetch viewable statuses:`);
      throw new BadRequestException({
        message: 'Failed to fetch viewable statuses',
        location: 'find_viewable',
      });
    }
  }

  async updateSort(status: RepairOrderStatus, newSort: number): Promise<{ message: string }> {
    const trx = await this.knex.transaction();
    try {
      this.logger.log(`Updating sort for status ${status.id} to ${newSort}`);
      if (newSort === status.sort) return { message: 'No change needed' };

      if (newSort < status.sort) {
        await trx('repair_order_statuses')
          .where({ branch_id: status.branch_id })
          .andWhere('sort', '>=', newSort)
          .andWhere('sort', '<', status.sort)
          .update({ sort: this.knex.raw('sort + 1') });
      } else {
        await trx('repair_order_statuses')
          .where({ branch_id: status.branch_id })
          .andWhere('sort', '<=', newSort)
          .andWhere('sort', '>', status.sort)
          .update({ sort: this.knex.raw('sort - 1') });
      }

      await trx('repair_order_statuses')
        .where({ id: status.id })
        .update({ sort: newSort, updated_at: new Date() });
      await trx.commit();

      await Promise.all([
        this.redisService.flushByPrefix(`${this.redisKeyView}${status.branch_id}:`),
        this.redisService.flushByPrefix(`${this.redisKeyAll}${status.branch_id}`),
      ]);
      this.logger.log(`Updated sort for status ${status.id}`);
      return { message: 'Sort updated successfully' };
    } catch (err) {
      await trx.rollback();
      this.logger.error(`Failed to update sort for status ${status.id}`);
      throw new BadRequestException({ message: 'Failed to update sort', location: 'update_sort' });
    }
  }

  async update(
    status: RepairOrderStatus,
    dto: UpdateRepairOrderStatusDto,
  ): Promise<{ message: string }> {
    const trx = await this.knex.transaction();
    try {
      this.logger.log(`Updating status ${status.id}`);
      if (dto.is_active === false && status.is_protected) {
        throw new ForbiddenException({
          message: 'Cannot deactivate protected status',
          location: 'status_protected',
        });
      }

      const branchId = dto.branch_id;
      if (branchId) {
        const branch = await trx<Branch>('branches')
          .where({ id: branchId, status: 'Open' })
          .first();
        if (!branch)
          throw new BadRequestException({
            message: 'Branch not found or deleted',
            location: 'branch_id',
          });
        if (!branch.is_active)
          throw new BadRequestException({ message: 'Branch inactive', location: 'branch_id' });
        await this.redisService.set(`branches:by_id:${branchId}`, branch, 3600);
      }

      if (dto.name_uz || dto.name_ru || dto.name_en) {
        const conflict = await trx('repair_order_statuses')
          .whereNot('id', status.id)
          .andWhere((qb) => {
            if (dto.name_uz) void qb.orWhereRaw('LOWER(name_uz) = LOWER(?)', [dto.name_uz]);
            if (dto.name_ru) void qb.orWhereRaw('LOWER(name_ru) = LOWER(?)', [dto.name_ru]);
            if (dto.name_en) void qb.orWhereRaw('LOWER(name_en) = LOWER(?)', [dto.name_en]);
          })
          .first();
        if (conflict)
          throw new BadRequestException({
            message: 'Status name already exists',
            location: 'name_conflict',
          });
      }

      const updateData: Partial<RepairOrderStatus> = {
        name_uz: dto.name_uz,
        name_ru: dto.name_ru,
        name_en: dto.name_en,
        branch_id: dto.branch_id,
        is_active: dto.is_active,
        can_user_view: dto.can_user_view,
        updated_at: new Date().toISOString(),
      };

      await trx('repair_order_statuses').where({ id: status.id }).update(updateData);
      const updated = await trx('repair_order_statuses').where({ id: status.id }).first();

      await trx.commit();
      await Promise.all([
        this.redisService.set(`${this.redisKeyById}:${status.id}`, updated, 3600),
        this.redisService.flushByPrefix(`${this.redisKeyView}${status.branch_id}:`),
        this.redisService.flushByPrefix(`${this.redisKeyAll}${status.branch_id}`),
      ]);
      return { message: 'Status updated successfully' };
    } catch (err) {
      await trx.rollback();
      this.logger.error(`Failed to update status ${status.id}`);
      throw new BadRequestException({
        message: 'Failed to update status',
        location: 'update_status',
      });
    }
  }

  async delete(status: RepairOrderStatus): Promise<{ message: string }> {
    const trx = await this.knex.transaction();
    try {
      this.logger.log(`Deleting status ${status.id}`);
      if (status.is_protected) {
        throw new ForbiddenException({
          message: 'Cannot delete protected status',
          location: 'status_protected',
        });
      }

      await trx('repair_order_statuses')
        .where({ id: status.id })
        .update({ status: 'Deleted', updated_at: new Date() });
      await this.repairOrderStatusPermissions.deletePermissionsByStatus(status.id);

      await trx.commit();
      await Promise.all([
        this.redisService.del(`${this.redisKeyById}:${status.id}`),
        this.redisService.flushByPrefix(`${this.redisKeyView}${status.branch_id}:`),
        this.redisService.flushByPrefix(`${this.redisKeyAll}${status.branch_id}`),
      ]);
      this.logger.log(`Deleted status ${status.id}`);
      return { message: 'Status deleted successfully' };
    } catch (err) {
      await trx.rollback();
      this.logger.error(`Failed to delete status ${status.id}`);
      throw new BadRequestException({
        message: 'Failed to delete status',
        location: 'delete_status',
      });
    }
  }

  async getOrLoadStatusById(statusId: string): Promise<RepairOrderStatus> {
    const redisKey = `${this.redisKeyById}:${statusId}`;
    const cached: RepairOrderStatus | null = await this.redisService.get(redisKey);
    if (cached) {
      this.logger.debug(`Cache hit for status ${statusId}`);
      return cached;
    }

    const status: RepairOrderStatus | undefined = await this.knex<RepairOrderStatus>(
      'repair_order_statuses',
    )
      .where({ id: statusId, status: 'Open' })
      .first();
    if (!status) {
      throw new BadRequestException({
        message: 'Repair order status not found or inactive',
        location: 'status_id',
      });
    }

    await this.redisService.set(redisKey, status, 3600);
    return status;
  }
}
