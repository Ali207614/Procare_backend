import { BadRequestException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import { RepairOrderRejectCause } from 'src/common/types/repair-order-reject-cause.interface';
import { RedisService } from 'src/common/redis/redis.service';
import { LoggerService } from 'src/common/logger/logger.service';
import { PaginationResult } from 'src/common/utils/pagination.util';
import { CreateRepairOrderRejectCauseDto } from './dto/create-repair-order-reject-cause.dto';
import { UpdateRepairOrderRejectCauseDto } from './dto/update-repair-order-reject-cause.dto';
import { FindAllRepairOrderRejectCausesDto } from './dto/find-all-repair-order-reject-causes.dto';
import { getNextSortValue } from 'src/common/utils/sort.util';
import { HistoryService } from 'src/history/history.service';

@Injectable()
export class RepairOrderRejectCausesService {
  private readonly tableName = 'repair_order_reject_causes';
  private readonly redisListPrefix = 'repair_order_reject_causes:list:';
  private readonly redisByIdPrefix = 'repair_order_reject_causes:id:';

  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly redisService: RedisService,
    private readonly logger: LoggerService,
    private readonly historyService: HistoryService,
  ) {}

  async create(
    dto: CreateRepairOrderRejectCauseDto,
    adminId?: string,
  ): Promise<RepairOrderRejectCause> {
    const trx = await this.knex.transaction();
    try {
      const name = this.normalizeName(dto.name);
      await this.ensureNameIsUnique(trx, name);

      const nextSort = await getNextSortValue(trx, this.tableName, {
        where: { status: 'Open' },
      });

      const [created] = await trx<RepairOrderRejectCause>(this.tableName)
        .insert({
          name,
          description: this.normalizeDescription(dto.description),
          is_active: dto.is_active ?? true,
          status: 'Open',
          sort: nextSort,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .returning('*');
      await this.historyService.recordEntityCreated({
        db: trx,
        entityTable: this.tableName,
        entityPk: created.id,
        entityLabel: created.name ?? null,
        actor: adminId ? { actorPk: adminId } : null,
        values: created as unknown as Record<string, unknown>,
      });

      await trx.commit();
      await this.invalidateListCache();

      return created;
    } catch (error) {
      await trx.rollback();

      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Failed to create repair order reject cause`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadRequestException({
        message: 'Failed to create reject cause',
        location: 'create_reject_cause',
      });
    }
  }

  async findAll(
    query: FindAllRepairOrderRejectCausesDto,
  ): Promise<PaginationResult<RepairOrderRejectCause>> {
    const { limit = 20, offset = 0, search } = query;
    const isActiveFilter = this.normalizeBooleanFilter(query.is_active);
    const normalizedSearch = search?.trim().toLowerCase();
    const cacheKey = `${this.redisListPrefix}${normalizedSearch ?? 'all'}:${typeof isActiveFilter === 'boolean' ? isActiveFilter : 'any'}:${offset}:${limit}`;
    const cached = await this.redisService.get<PaginationResult<RepairOrderRejectCause>>(cacheKey);
    if (cached) {
      return cached;
    }

    const baseQuery = this.knex<RepairOrderRejectCause>(this.tableName).where({ status: 'Open' });

    if (typeof isActiveFilter === 'boolean') {
      void baseQuery.andWhere({ is_active: isActiveFilter });
    }

    if (normalizedSearch) {
      void baseQuery.andWhereRaw('LOWER(name) ILIKE ?', [`%${normalizedSearch}%`]);
    }

    const [rows, countResult] = await Promise.all([
      baseQuery.clone().orderBy('sort', 'asc').offset(offset).limit(limit),
      baseQuery.clone().count<{ count: string }[]>('* as count'),
    ]);

    const result: PaginationResult<RepairOrderRejectCause> = {
      rows,
      total: Number(countResult[0]?.count ?? 0),
      limit,
      offset,
    };

    await this.redisService.set(cacheKey, result, 3600);
    return result;
  }

  async findOne(id: string): Promise<RepairOrderRejectCause> {
    const cacheKey = `${this.redisByIdPrefix}${id}`;
    const cached = await this.redisService.get<RepairOrderRejectCause>(cacheKey);
    if (cached) {
      return cached;
    }

    const cause = await this.knex<RepairOrderRejectCause>(this.tableName)
      .where({ id })
      .whereNot('status', 'Deleted')
      .first();

    if (!cause) {
      throw new NotFoundException({
        message: 'Reject cause not found',
        location: 'reject_cause_id',
      });
    }

    await this.redisService.set(cacheKey, cause, 3600);
    return cause;
  }

  async update(
    id: string,
    dto: UpdateRepairOrderRejectCauseDto,
    adminId?: string,
  ): Promise<{ message: string }> {
    const trx = await this.knex.transaction();
    try {
      const existing = await this.getOpenCauseOrThrow(trx, id);
      const updateData: Partial<RepairOrderRejectCause> = {
        updated_at: new Date().toISOString(),
      };

      if (dto.name !== undefined) {
        const name = this.normalizeName(dto.name);
        await this.ensureNameIsUnique(trx, name, id);
        updateData.name = name;
      }

      if (dto.description !== undefined) {
        updateData.description = this.normalizeDescription(dto.description);
      }

      if (dto.is_active !== undefined) {
        updateData.is_active = dto.is_active;
      }

      await trx<RepairOrderRejectCause>(this.tableName)
        .where({ id: existing.id })
        .update(updateData);
      await this.historyService.recordEntityUpdated({
        db: trx,
        entityTable: this.tableName,
        entityPk: id,
        entityLabel: existing.name ?? null,
        actor: adminId ? { actorPk: adminId } : null,
        before: existing as unknown as Record<string, unknown>,
        after: { ...existing, ...updateData } as Record<string, unknown>,
        fields: Object.keys(dto),
      });
      await trx.commit();

      await this.invalidateCache(id);
      return { message: 'Reject cause updated successfully' };
    } catch (error) {
      await trx.rollback();

      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Failed to update repair order reject cause ${id}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadRequestException({
        message: 'Failed to update reject cause',
        location: 'update_reject_cause',
      });
    }
  }

  async updateSort(id: string, newSort: number, adminId?: string): Promise<{ message: string }> {
    const trx = await this.knex.transaction();
    try {
      const existing = await this.getOpenCauseOrThrow(trx, id);
      const maxResult = await trx<RepairOrderRejectCause>(this.tableName)
        .where({ status: 'Open' })
        .max<{ max: number | null }[]>('sort as max');

      const maxSort = Number(maxResult[0]?.max ?? existing.sort);
      const targetSort = Math.max(1, Math.min(newSort, maxSort));

      if (targetSort === existing.sort) {
        await trx.commit();
        return { message: 'No change needed' };
      }

      if (targetSort < existing.sort) {
        await trx<RepairOrderRejectCause>(this.tableName)
          .where({ status: 'Open' })
          .andWhere('sort', '>=', targetSort)
          .andWhere('sort', '<', existing.sort)
          .increment('sort', 1);
      } else {
        await trx<RepairOrderRejectCause>(this.tableName)
          .where({ status: 'Open' })
          .andWhere('sort', '<=', targetSort)
          .andWhere('sort', '>', existing.sort)
          .decrement('sort', 1);
      }

      await trx<RepairOrderRejectCause>(this.tableName).where({ id }).update({
        sort: targetSort,
        updated_at: new Date().toISOString(),
      });
      await this.historyService.recordEntityUpdated({
        db: trx,
        entityTable: this.tableName,
        entityPk: id,
        entityLabel: existing.name ?? null,
        actor: adminId ? { actorPk: adminId } : null,
        before: existing as unknown as Record<string, unknown>,
        after: { ...existing, sort: targetSort } as Record<string, unknown>,
        fields: ['sort'],
      });
      await trx.commit();

      await this.invalidateCache(id);
      return { message: 'Reject cause sort updated successfully' };
    } catch (error) {
      await trx.rollback();

      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Failed to update reject cause sort ${id}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadRequestException({
        message: 'Failed to update reject cause sort',
        location: 'update_reject_cause_sort',
      });
    }
  }

  async delete(id: string, adminId?: string): Promise<{ message: string }> {
    const trx = await this.knex.transaction();
    try {
      const existing = await this.getOpenCauseOrThrow(trx, id);

      await trx<RepairOrderRejectCause>(this.tableName).where({ id }).update({
        status: 'Deleted',
        updated_at: new Date().toISOString(),
      });
      await this.historyService.recordEntityDeleted({
        db: trx,
        entityTable: this.tableName,
        entityPk: id,
        entityLabel: existing.name ?? null,
        actor: adminId ? { actorPk: adminId } : null,
        before: existing as unknown as Record<string, unknown>,
        fields: ['status'],
      });
      await trx.commit();

      await this.invalidateCache(id);
      return { message: 'Reject cause deleted successfully' };
    } catch (error) {
      await trx.rollback();

      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Failed to delete reject cause ${id}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadRequestException({
        message: 'Failed to delete reject cause',
        location: 'delete_reject_cause',
      });
    }
  }

  private async getOpenCauseOrThrow(
    knex: Knex | Knex.Transaction,
    id: string,
  ): Promise<RepairOrderRejectCause> {
    const cause = await knex<RepairOrderRejectCause>(this.tableName)
      .where({ id, status: 'Open' })
      .first();

    if (!cause) {
      throw new NotFoundException({
        message: 'Reject cause not found',
        location: 'reject_cause_id',
      });
    }

    return cause;
  }

  private async ensureNameIsUnique(
    knex: Knex | Knex.Transaction,
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const query = knex<RepairOrderRejectCause>(this.tableName)
      .where({ status: 'Open' })
      .andWhereRaw('LOWER(name) = LOWER(?)', [name]);

    if (excludeId) {
      void query.whereNot('id', excludeId);
    }

    const existing = await query.first();
    if (existing) {
      throw new BadRequestException({
        message: 'Reject cause name already exists',
        location: 'name',
      });
    }
  }

  private normalizeName(name: string): string {
    return name.trim();
  }

  private normalizeDescription(description?: string | null): string | null {
    if (description === undefined || description === null) {
      return null;
    }

    const normalized = description.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeBooleanFilter(value: unknown): boolean | undefined {
    if (typeof value === 'boolean') {
      return value;
    }

    if (value === 'true') {
      return true;
    }

    if (value === 'false') {
      return false;
    }

    return undefined;
  }

  private async invalidateListCache(): Promise<void> {
    await this.redisService.flushByPrefix(this.redisListPrefix);
  }

  private async invalidateCache(id: string): Promise<void> {
    await Promise.all([
      this.invalidateListCache(),
      this.redisService.del(`${this.redisByIdPrefix}${id}`),
    ]);
  }
}
