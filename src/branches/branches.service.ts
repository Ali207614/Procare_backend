import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Knex } from 'knex';
import { InjectKnex } from 'nestjs-knex';
import { RedisService } from 'src/common/redis/redis.service';
import { getNextSortValue } from 'src/common/utils/sort.util';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { RepairOrderStatusPermissionsService } from 'src/repair-order-status-permission/repair-order-status-permissions.service';
import { Branch } from 'src/common/types/branch.interface';

/**
 * Service for managing branches with Knex and Redis integration.
 */
@Injectable()
export class BranchesService {
  private readonly logger = new Logger(BranchesService.name);
  private readonly redisKey = 'branches:all';
  private readonly redisKeyById = 'branches:by_id';

  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly redisService: RedisService,
    private readonly repairOrderStatusPermissionsService: RepairOrderStatusPermissionsService,
  ) {}

  private getAdminBranchesKey(adminId: string): string {
    return `admin:${adminId}:branches`;
  }

  private async flushCacheByPrefix(prefix: string): Promise<void> {
    await this.redisService.flushByPrefix(prefix);
    this.logger.debug(`Cache flushed for prefix: ${prefix}`);
  }

  async create(dto: CreateBranchDto, adminId: string): Promise<Branch> {
    return await this.knex.transaction(async (trx: Knex.Transaction) => {
      this.logger.log(`Creating branch by admin: ${adminId}`);
      const existing: Branch | undefined = await trx('branches')
        .whereRaw(
          'LOWER(name_uz) = LOWER(?) OR LOWER(name_ru) = LOWER(?) OR LOWER(name_en) = LOWER(?)',
          [dto.name_uz, dto.name_ru, dto.name_en],
        )
        .andWhereNot({ status: 'Deleted' })
        .first();

      if (existing) {
        throw new BadRequestException('Branch name already exists in one of the languages');
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
      await this.redisService.set(`${this.redisKeyById}:${branch.id}`, branch, 3600);
      this.logger.log(`Branch created: ${branch.id}`);

      return branch;
    });
  }

  async findAll(offset = 0, limit = 10, search?: string): Promise<Branch[]> {
    const redisKey = search
      ? `${this.redisKey}:search:${search}:${offset}:${limit}`
      : `${this.redisKey}:${offset}:${limit}`;
    const cached: Branch[] | null = await this.redisService.get(redisKey);
    if (cached) {
      this.logger.debug(`Cache hit for branches: ${redisKey}`);
      return cached;
    }

    const query = this.knex('branches').where({ status: 'Open' });
    if (search?.trim()) {
      void query.andWhere(
        (qb) =>
          void qb
            .whereILike('name_uz', `%${search}%`)
            .orWhereILike('name_ru', `%${search}%`)
            .orWhereILike('name_en', `%${search}%`),
      );
    }

    const branches: Branch[] = await query.orderBy('sort', 'asc').offset(offset).limit(limit);
    await this.redisService.set(redisKey, branches, 3600);
    this.logger.log(`Fetched ${branches.length} branches`);

    return branches;
  }

  async findByAdminId(adminId: string): Promise<Branch[]> {
    const redisKey = this.getAdminBranchesKey(adminId);
    const cached: Branch[] | null = await this.redisService.get(redisKey);
    if (cached) {
      this.logger.debug(`Cache hit for admin branches: ${redisKey}`);
      return cached;
    }

    const branches: Branch[] = await this.knex('branches as b')
      .join('admin_branches as ab', 'ab.branch_id', 'b.id')
      .where({ 'ab.admin_id': adminId, 'b.status': 'Open', 'b.is_active': true })
      .select('b.id', 'b.name_uz', 'b.name_ru', 'b.name_en', 'b.bg_color', 'b.color', 'b.sort')
      .orderBy('b.sort', 'asc');

    await this.redisService.set(redisKey, branches, 3600);
    this.logger.log(`Fetched ${branches.length} branches for admin: ${adminId}`);

    return branches;
  }

  async findOne(id: string): Promise<Branch> {
    const redisKey = `${this.redisKeyById}:${id}`;
    const cached: Branch | null = await this.redisService.get(redisKey);
    if (cached) {
      this.logger.debug(`Cache hit for branch: ${redisKey}`);
      return cached;
    }

    const branch: Branch | undefined = await this.knex('branches')
      .where({ id, status: 'Open' })
      .first();
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    await this.redisService.set(redisKey, branch, 3600);
    this.logger.log(`Fetched branch: ${id}`);
    return branch;
  }

  /**
   * Updates the sort order of a branch.
   * @param branch Branch to update.
   * @param newSort New sort value.
   * @returns Success message.
   */
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
      this.logger.log(`Updated sort for branch: ${branch.id}`);

      return { message: 'Sort updated successfully' };
    } catch (error) {
      await trx.rollback();
      this.logger.error(`Failed to update sort for branch ${branch.id}`);
      throw new BadRequestException('Failed to update sort order');
    }
  }

  async update(branch: Branch, dto: UpdateBranchDto): Promise<{ message: string }> {
    if (dto.is_active === false && branch.is_protected) {
      throw new ForbiddenException('Cannot deactivate protected branch');
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
        throw new BadRequestException('Branch name already exists');
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
    this.logger.log(`Updated branch: ${branch.id}`);

    return { message: 'Branch updated successfully' };
  }

  async delete(branch: Branch): Promise<{ message: string }> {
    if (branch.is_protected) {
      throw new ForbiddenException('Cannot delete protected branch');
    }

    await this.knex('branches').where({ id: branch.id }).update({
      is_active: false,
      status: 'Deleted',
      updated_at: new Date(),
    });

    await this.repairOrderStatusPermissionsService.deletePermissionsByBranch(branch.id);
    await this.redisService.del(`${this.redisKeyById}:${branch.id}`);
    await this.flushCacheByPrefix(this.redisKey);
    this.logger.log(`Deleted branch: ${branch.id}`);

    return { message: 'Branch deleted successfully' };
  }
}
