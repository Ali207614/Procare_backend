import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Knex } from 'knex';
import { InjectKnex } from 'nestjs-knex';
import { RedisService } from 'src/common/redis/redis.service';
import { getNextSortValue } from 'src/common/utils/sort.util';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { RepairOrderStatusPermissionsService } from 'src/repair-order-status-permission/repair-order-status-permissions.service';
import { Branch } from 'src/common/types/branch.interface';
import { RepairOrderStatusPermission } from 'src/common/types/repair-order-status-permssion.interface';

@Injectable()
export class BranchesService {
  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly redisService: RedisService,
    private readonly repairOrderStatusPermissionsService: RepairOrderStatusPermissionsService,
  ) {}

  private readonly redisKey = 'branches:all';
  private readonly redisKeyById = 'branches:by_id';

  private getAdminBranchesKey(adminId: string): string {
    return `admin:${adminId}:branches`;
  }

  async create(dto: CreateBranchDto, adminId: string): Promise<Branch> {
    return await this.knex.transaction(async (trx) => {
      const existing: Branch | undefined = await trx('branches')
        .whereRaw('LOWER(name_uz) = LOWER(?)', [dto.name_uz])
        .orWhereRaw('LOWER(name_ru) = LOWER(?)', [dto.name_ru])
        .orWhereRaw('LOWER(name_en) = LOWER(?)', [dto.name_en])
        .andWhereNot({ status: 'Deleted' })
        .first();

      if (existing) {
        throw new BadRequestException({
          message: 'Branch name already exists in one of the languages',
          location: 'branch_name_conflict',
        });
      }

      const nextSort = await getNextSortValue(this.knex, 'branches');

      const insertData = {
        ...dto,
        sort: nextSort,
        created_by: adminId,
      };

      const inserted: Branch[] = await trx('branches').insert(insertData).returning('*');

      const branch = inserted[0];

      const now = new Date();

      const predefinedStatuses = [
        {
          key: 'Completed',
          names: { uz: 'Tugallangan', ru: 'Завершено', en: 'Completed' },
          bg_color: '#27ae60',
          can_user_view: true,
        },
        {
          key: 'Cancelled',
          names: { uz: 'Bekor qilingan', ru: 'Отменено', en: 'Cancelled' },
          bg_color: '#c0392b',
          can_user_view: false,
        },
      ];

      await trx('repair_order_statuses').insert(
        predefinedStatuses.map((s, index) => ({
          name_uz: s.names.uz,
          name_ru: s.names.ru,
          name_en: s.names.en,
          bg_color: s.bg_color,
          color: '#ffffff',
          sort: 1000 + index,
          can_user_view: s.can_user_view,
          can_add_payment: false,
          is_active: true,
          is_protected: true,
          type: s.key,
          status: 'Open',
          branch_id: branch.id,
          created_by: adminId,
          created_at: now,
          updated_at: now,
        })),
      );

      await this.redisService.flushByPrefix(`${this.redisKey}`);
      await this.redisService.flushByPrefix(`${this.redisKeyById}`);

      const allBranches = await this.knex('branches').where({ status: 'Open' });

      await Promise.all(
        allBranches.map((b) => this.redisService.set(`${this.redisKeyById}:${b.id}`, b, 3600)),
      );

      return branch;
    });
  }

  async findAll(offset = 0, limit = 10, search?: string): Promise<Branch[]> {
    const isSearch = Boolean(search);
    const redisKey = isSearch ? null : `${this.redisKey}:${offset}:${limit}`;

    if (redisKey) {
      const cached: Branch[] | null = await this.redisService.get(redisKey);
      if (cached !== null) return cached;
    }

    const query = this.knex('branches').where({ status: 'Open' });

    if (isSearch && search?.trim()) {
      void query.andWhere((qb: Knex.QueryBuilder) => {
        void qb
          .whereILike('name_uz', `%${search}%`)
          .orWhereILike('name_ru', `%${search}%`)
          .orWhereILike('name_en', `%${search}%`);
      });
    }

    const branches: Branch[] = await query.orderBy('sort', 'asc').offset(offset).limit(limit);

    if (redisKey) {
      await this.redisService.set(redisKey, branches, 3600);
    }

    return branches;
  }

  async findByAdminId(adminId: string): Promise<Branch[]> {
    const redisKey = this.getAdminBranchesKey(adminId);

    const cached: Branch[] | null = await this.redisService.get(redisKey);
    if (cached !== null) {
      console.log('🔄 Cache hit for admin branches');
      return cached;
    }

    const branches: Branch[] = await this.knex('branches as b')
      .join('admin_branches as ab', 'ab.branch_id', 'b.id')
      .where('ab.admin_id', adminId)
      .andWhere('b.status', 'Open')
      .andWhere('b.is_active', true)
      .select('b.id', 'b.name_uz', 'b.name_ru', 'b.name_en', 'b.bg_color', 'b.color', 'b.sort')
      .orderBy('b.sort', 'asc');

    await this.redisService.set(redisKey, branches, 3600);
    console.log('🔄 Knex hit for admin branches');

    return branches;
  }


  async findOne(id: string): Promise<Branch> {
    const branch: Branch | undefined = await this.knex('branches')
      .where({ id, status: 'Open' })
      .first();
    if (!branch)
      throw new NotFoundException({
        message: 'Branch not found',
        location: 'branch_not_found',
      });
    return branch;
  }

  async updateSort(branch: Branch, newSort: number): Promise<{ message: string }> {
    const trx = await this.knex.transaction();

    try {
      const currentSort = branch.sort;

      if (newSort === currentSort) {
        return { message: 'No change needed' };
      }

      if (newSort < currentSort) {
        await trx('branches')
          .where('sort', '>=', newSort)
          .andWhere('sort', '<', currentSort)
          .update({ sort: this.knex.raw('sort + 1') });
      } else {
        await trx('branches')
          .where('sort', '<=', newSort)
          .andWhere('sort', '>', currentSort)
          .update({ sort: this.knex.raw('sort - 1') });
      }

      await trx('branches')
        .where({ id: branch.id })
        .update({ sort: newSort, updated_at: new Date() });

      await trx.commit();

      await this.redisService.flushByPrefix(`${this.redisKey}`);
      await this.redisService.flushByPrefix(`${this.redisKeyById}`);

      return { message: 'Sort updated successfully' };
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  async update(branch: Branch, dto: UpdateBranchDto): Promise<{ message: string }> {
    if (dto?.is_active === false && branch?.is_protected) {
      throw new ForbiddenException({
        message: 'This branch is system-protected and cannot be deleted or deactivated.',
        location: 'branch_protected',
      });
    }

    if (dto.name_uz || dto.name_ru || dto.name_en) {
      const conflict = await this.knex('branches')
        .whereNot('id', branch.id)
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

    await this.knex('branches')
      .where({ id: branch.id })
      .update({
        ...dto,
        updated_at: new Date(),
      });

    const updated: Branch | undefined = await this.knex('branches')
      .where({ id: branch.id })
      .first();

    await this.redisService.set(`${this.redisKeyById}:${branch.id}`, updated, 3600);
    await this.redisService.flushByPrefix(`${this.redisKey}`);

    return { message: 'Branches updated successfully' };
  }

  async delete(branch: Branch): Promise<{ message: string }> {
    const branchId = branch.id;

    if (branch?.is_protected) {
      throw new ForbiddenException({
        message: 'This branch is system-protected and cannot be deleted or deactivated.',
        location: 'branch_protected',
      });
    }

    await this.knex('branches').where({ id: branchId }).update({
      is_active: false,
      status: 'Deleted',
      updated_at: new Date(),
    });

    const permissions: RepairOrderStatusPermission[] = await this.knex(
      'repair_order_status_permissions',
    ).where({
      branch_id: branchId,
    });

    if (permissions.length > 0) {
      await this.knex('repair_order_status_permissions').where({ branch_id: branchId }).del();

      for (const permission of permissions) {
        await this.repairOrderStatusPermissionsService.flushAndReloadCacheByRole(permission);
      }
    }

    await this.redisService.del(`${this.redisKeyById}:${branchId}`);
    await this.redisService.flushByPrefix(`${this.redisKey}`);

    return { message: 'Branch deleted successfully' };
  }
}
