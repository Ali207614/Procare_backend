import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  HttpException,
} from '@nestjs/common';
import { Knex } from 'knex';
import { InjectKnex } from 'nestjs-knex';
import { RedisService } from 'src/common/redis/redis.service';
import { getNextSortValue } from 'src/common/utils/sort.util';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { RepairOrderStatusPermissionsService } from 'src/repair-order-status-permission/repair-order-status-permissions.service';
import { Branch, BranchWithAdmins } from 'src/common/types/branch.interface';
import { LoggerService } from 'src/common/logger/logger.service';
import { PaginationResult } from 'src/common/utils/pagination.util';

@Injectable()
export class BranchesService {
  private readonly redisKey = 'branches:all';
  private readonly redisKeyById = 'branches:by_id';
  private readonly redisKeyByAdminId = 'admin:branches';

  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly redisService: RedisService,
    private readonly repairOrderStatusPermissionsService: RepairOrderStatusPermissionsService,
    private readonly logger: LoggerService,
  ) {}

  private getAdminBranchesKey(adminId: string): string {
    return `admin:branches:${adminId}`;
  }

  private async flushCacheByPrefix(prefix: string): Promise<void> {
    await this.redisService.flushByPrefix(prefix);
    this.logger.debug(`Cache flushed for prefix: ${prefix}`);
  }

  async create(dto: CreateBranchDto, adminId: string): Promise<Branch> {
    return await this.knex.transaction(async (trx: Knex.Transaction) => {
      const existing: Branch | undefined = await trx('branches')
        .whereRaw(
          `(LOWER(name_uz) = LOWER(?) OR LOWER(name_ru) = LOWER(?) OR LOWER(name_en) = LOWER(?)) AND status != ?`,
          [dto.name_uz, dto.name_ru, dto.name_en, 'Deleted'],
        )
        .first();
      if (existing) {
        throw new BadRequestException({
          message: 'Branch name already exists',
          location: 'name',
        });
      }

      const nextSort = await getNextSortValue(trx, 'branches');
      const insertData = {
        name_uz: dto.name_uz,
        name_ru: dto.name_ru,
        name_en: dto.name_en,
        address_uz: dto.address_uz,
        address_ru: dto.address_ru,
        address_en: dto.address_en,
        lat: dto.lat,
        long: dto.long,
        support_phone: dto.support_phone,
        work_start_time: dto.work_start_time,
        work_end_time: dto.work_end_time,
        bg_color: dto.bg_color,
        color: dto.color,
        is_active: dto.is_active ?? true,
        can_user_view: dto.can_user_view ?? true,
        sort: nextSort,
        created_by: adminId,
        created_at: new Date(),
      };

      const [branch]: Branch[] = await trx('branches').insert(insertData).returning('*');

      const now = new Date();
      await trx('repair_order_statuses').insert([
        {
          name_uz: 'Tugallangan',
          name_ru: 'Завершено',
          name_en: 'Completed',
          bg_color: '#27ae60',
          color: '#ffffff',
          sort: 1000,
          can_user_view: true,
          can_add_payment: false,
          is_active: true,
          is_protected: true,
          type: 'Completed',
          status: 'Open',
          branch_id: branch.id,
          created_by: adminId,
          created_at: now,
          updated_at: now,
        },
        {
          name_uz: 'Bekor qilingan',
          name_ru: 'Отменено',
          name_en: 'Cancelled',
          bg_color: '#c0392b',
          color: '#ffffff',
          sort: 1001,
          can_user_view: false,
          can_add_payment: false,
          is_active: true,
          is_protected: true,
          type: 'Cancelled',
          status: 'Open',
          branch_id: branch.id,
          created_by: adminId,
          created_at: now,
          updated_at: now,
        },
      ]);

      await this.flushCacheByPrefix(this.redisKey);
      await this.flushCacheByPrefix(this.redisKeyByAdminId);
      await this.redisService.set(`${this.redisKeyById}:${branch.id}`, branch, 3600);
      return branch;
    });
  }

  async findAll(offset = 0, limit = 10, search?: string): Promise<PaginationResult<Branch>> {
    const baseQuery = this.knex('branches').where({ status: 'Open' });

    if (search?.trim()) {
      void baseQuery.andWhere(
        (qb) =>
          void qb
            .whereILike('name_uz', `%${search}%`)
            .orWhereILike('name_ru', `%${search}%`)
            .orWhereILike('name_en', `%${search}%`),
      );

      const [rows, [{ count }]] = await Promise.all([
        baseQuery.clone().orderBy('sort', 'asc').offset(offset).limit(limit),
        baseQuery.clone().count('* as count'),
      ]);

      return {
        rows,
        total: Number(count),
        limit,
        offset,
      };
    }

    // cache key
    const redisKey = `${this.redisKey}:${offset}:${limit}`;

    const cached: PaginationResult<Branch> | null = await this.redisService.get(redisKey);
    if (cached) return cached;

    const [rows, [{ count }]] = await Promise.all([
      this.knex('branches')
        .where({ status: 'Open' })
        .orderBy('sort', 'asc')
        .offset(offset)
        .limit(limit),
      this.knex('branches').where({ status: 'Open' }).count('* as count'),
    ]);

    const result: PaginationResult<Branch> = {
      rows,
      total: Number(count),
      limit,
      offset,
    };

    await this.redisService.set(redisKey, result, 3600);
    return result;
  }

  async findByAdminId(adminId: string, offset = 0, limit = 20): Promise<PaginationResult<Branch>> {
    const redisKey = `${this.getAdminBranchesKey(adminId)}:${offset}:${limit}`;
    const cached: PaginationResult<Branch> | null = await this.redisService.get(redisKey);
    if (cached) {
      return cached;
    }

    const baseQuery = this.knex('branches as b')
      .join('admin_branches as ab', 'ab.branch_id', 'b.id')
      .where({
        'ab.admin_id': adminId,
        'b.status': 'Open',
        'b.is_active': true,
      });

    const [rows, [{ count }]] = await Promise.all([
      baseQuery
        .clone()
        .select('b.id', 'b.name_uz', 'b.name_ru', 'b.name_en', 'b.bg_color', 'b.color', 'b.sort')
        .orderBy('b.sort', 'asc')
        .offset(offset)
        .limit(limit),

      baseQuery.clone().count('* as count'),
    ]);

    const result: PaginationResult<Branch> = {
      rows,
      total: Number(count),
      limit,
      offset,
    };

    await this.redisService.set(redisKey, result, 3600);
    return result;
  }

  async findOne(id: string): Promise<BranchWithAdmins> {
    const redisKey = `${this.redisKeyById}:${id}`;
    const cached: BranchWithAdmins | null = await this.redisService.get(redisKey);
    if (cached) return cached;

    const branch: BranchWithAdmins = await this.knex
      .select([
        'b.*',
        this.knex.raw(`
        COALESCE(
          json_agg(
            json_build_object(
              'id', a.id,
              'first_name', a.first_name,
              'last_name', a.last_name,
              'phone_number', a.phone_number,
              'is_active', a.is_active
            )
          ) FILTER (WHERE a.id IS NOT NULL), '[]'
        ) as admins
      `),
      ])
      .from('branches as b')
      .leftJoin('admin_branches as ab', 'b.id', 'ab.branch_id')
      .leftJoin('admins as a', function () {
        this.on('a.id', '=', 'ab.admin_id').andOnVal('a.status', '=', 'Open');
      })
      .where('b.id', id)
      .andWhere('b.status', 'Open')
      .groupBy('b.id')
      .first();

    if (!branch) {
      throw new NotFoundException({
        message: 'Branch not found',
        location: 'branches',
      });
    }

    await this.redisService.set(redisKey, branch, 3600);
    return branch;
  }

  async updateSort(branch: Branch, newSort: number): Promise<{ message: string }> {
    if (branch.sort === newSort) {
      return { message: 'No change needed' };
    }

    const trx = await this.knex.transaction();
    try {
      if (newSort < branch.sort) {
        await trx('branches')
          .whereBetween('sort', [newSort, branch.sort - 1])
          .update({ sort: this.knex.raw('sort + 1') });
      } else {
        await trx('branches')
          .whereBetween('sort', [branch.sort + 1, newSort])
          .update({ sort: this.knex.raw('sort - 1') });
      }

      await trx('branches')
        .where({ id: branch.id })
        .update({ sort: newSort, updated_at: new Date() });
      await trx.commit();

      await this.flushCacheByPrefix(this.redisKey);
      await this.flushCacheByPrefix(this.redisKeyById);
      await this.flushCacheByPrefix(this.redisKeyByAdminId);

      return { message: 'Sort updated successfully' };
    } catch (error) {
      await trx.rollback();
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Failed to update sort for branch ${branch.id}`);
      throw new BadRequestException({
        message: 'Failed to update branch sort',
        location: 'branches',
      });
    }
  }

  async update(branch: Branch, dto: UpdateBranchDto): Promise<{ message: string }> {
    if (dto.is_active === false && branch.is_protected) {
      throw new ForbiddenException({
        message: 'Cannot deactivate protected branch',
        location: 'branches',
      });
    }

    if (dto.name_uz || dto.name_ru || dto.name_en) {
      const conflict: Branch | undefined = await this.knex('branches')
        .whereNot('id', branch.id)
        .andWhere((qb) => {
          if (dto.name_uz) void qb.orWhereRaw('LOWER(name_uz) = LOWER(?)', [dto.name_uz]);
          if (dto.name_ru) void qb.orWhereRaw('LOWER(name_ru) = LOWER(?)', [dto.name_ru]);
          if (dto.name_en) void qb.orWhereRaw('LOWER(name_en) = LOWER(?)', [dto.name_en]);
        })
        .first();

      if (conflict) {
        throw new BadRequestException({
          message: 'Branch name already exists',
          location: 'name',
        });
      }
    }

    const updateData = {
      name_uz: dto.name_uz,
      name_ru: dto.name_ru,
      name_en: dto.name_en,
      address_uz: dto.address_uz,
      address_ru: dto.address_ru,
      address_en: dto.address_en,
      lat: dto.lat,
      long: dto.long,
      support_phone: dto.support_phone,
      work_start_time: dto.work_start_time,
      work_end_time: dto.work_end_time,
      bg_color: dto.bg_color,
      color: dto.color,
      is_active: dto.is_active,
      can_user_view: dto.can_user_view,
      updated_at: new Date(),
    };

    await this.knex('branches').where({ id: branch.id }).update(updateData);
    const updated = await this.knex('branches').where({ id: branch.id }).first();

    await this.redisService.set(`${this.redisKeyById}:${branch.id}`, updated, 3600);
    await this.flushCacheByPrefix(this.redisKey);
    await this.flushCacheByPrefix(this.redisKeyByAdminId);

    return { message: 'Branch updated successfully' };
  }

  async delete(branch: Branch): Promise<{ message: string }> {
    if (branch.is_protected) {
      throw new ForbiddenException({
        message: 'Cannot delete protected branch',
        location: 'branches',
      });
    }

    await this.knex('branches').where({ id: branch.id }).update({
      is_active: false,
      status: 'Deleted',
      updated_at: new Date(),
    });

    await this.repairOrderStatusPermissionsService.deletePermissionsByBranch(branch.id);
    await this.redisService.del(`${this.redisKeyById}:${branch.id}`);
    await this.flushCacheByPrefix(this.redisKeyByAdminId);

    await this.flushCacheByPrefix(this.redisKey);
    this.logger.log(`Deleted branch: ${branch.id}`);

    return { message: 'Branch deleted successfully' };
  }

  async assignAdmins(branchId: string, adminIds: string[]): Promise<{ message: string }> {
    return this.knex.transaction(async (trx) => {
      const validAdmins = await trx('admins')
        .whereIn('id', adminIds)
        .andWhere({ status: 'Open', is_active: true });

      if (validAdmins.length !== adminIds.length) {
        throw new NotFoundException({
          message: 'One or more admins not found or inactive',
          location: 'admin_ids',
        });
      }

      const uniqueAdminIds = [...new Set(adminIds)];
      if (uniqueAdminIds.length !== adminIds.length) {
        throw new BadRequestException({
          message: 'Duplicate admin IDs provided',
          location: 'admin_ids',
        });
      }

      const existing: { admin_id: string; branch_id: string }[] = await trx('admin_branches')
        .whereIn('admin_id', uniqueAdminIds)
        .andWhere('branch_id', branchId);

      if (existing.length > 0) {
        const alreadyAssigned = existing.map((e) => e.admin_id);
        throw new BadRequestException({
          message: `Admins already assigned: ${alreadyAssigned.join(', ')}`,
          location: 'admin_ids',
        });
      }

      const insertRows = uniqueAdminIds.map((id) => ({
        admin_id: id,
        branch_id: branchId,
      }));

      await trx('admin_branches').insert(insertRows);

      await this.flushCacheByPrefix(this.redisKeyByAdminId);
      await this.flushCacheByPrefix(this.redisKey);

      return { message: 'Admins assigned to branch successfully' };
    });
  }

  async removeAdmins(branchId: string, adminIds: string[]): Promise<{ message: string }> {
    return this.knex.transaction(async (trx) => {
      const existing = await trx('admin_branches')
        .whereIn('admin_id', adminIds)
        .andWhere('branch_id', branchId);

      if (existing.length === 0) {
        throw new NotFoundException({
          message: 'No matching admin-branch assignments found',
          location: 'admin_ids',
        });
      }

      await trx('admin_branches')
        .whereIn('admin_id', adminIds)
        .andWhere('branch_id', branchId)
        .del();

      await this.flushCacheByPrefix(this.redisKeyByAdminId);
      await this.flushCacheByPrefix(this.redisKey);

      return { message: 'Admins removed from branch successfully' };
    });
  }
}
