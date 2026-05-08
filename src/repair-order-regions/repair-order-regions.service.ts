import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Knex } from 'knex';
import { InjectKnex } from 'nestjs-knex';
import { LoggerService } from 'src/common/logger/logger.service';
import { RedisService } from 'src/common/redis/redis.service';
import { RepairOrderRegion } from 'src/common/types/repair-order-region.interface';
import { PaginationResult } from 'src/common/utils/pagination.util';
import { CreateRepairOrderRegionDto } from './dto/create-repair-order-region.dto';
import { FindAllRepairOrderRegionsDto } from './dto/find-all-repair-order-regions.dto';
import { UpdateRepairOrderRegionDto } from './dto/update-repair-order-region.dto';
import { HistoryService } from 'src/history/history.service';

@Injectable()
export class RepairOrderRegionsService {
  private readonly tableName = 'repair_order_regions';
  private readonly redisListPrefix = 'repair_order_regions:list:';
  private readonly redisByIdPrefix = 'repair_order_regions:id:';

  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly redisService: RedisService,
    private readonly logger: LoggerService,
    private readonly historyService: HistoryService,
  ) {}

  async create(dto: CreateRepairOrderRegionDto, adminId?: string): Promise<RepairOrderRegion> {
    const trx = await this.knex.transaction();

    try {
      const title = this.normalizeTitle(dto.title);
      await this.ensureTitleIsUnique(trx, title);

      const [created] = await trx<RepairOrderRegion>(this.tableName)
        .insert({
          title,
          description: this.normalizeDescription(dto.description),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .returning('*');
      await this.historyService.recordEntityCreated({
        db: trx,
        entityTable: this.tableName,
        entityPk: created.id,
        entityLabel: created.title ?? null,
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
        'Failed to create repair order region',
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadRequestException({
        message: 'Failed to create repair order region',
        location: 'create_repair_order_region',
      });
    }
  }

  async findAll(query: FindAllRepairOrderRegionsDto): Promise<PaginationResult<RepairOrderRegion>> {
    const { limit = 20, offset = 0, search } = query;
    const normalizedSearch = search?.trim().toLowerCase();
    const cacheKey = `${this.redisListPrefix}${normalizedSearch ?? 'all'}:${offset}:${limit}`;
    const cached = await this.redisService.get<PaginationResult<RepairOrderRegion>>(cacheKey);
    if (cached) {
      return cached;
    }

    const baseQuery = this.knex<RepairOrderRegion>(this.tableName);

    if (normalizedSearch) {
      void baseQuery.andWhereRaw('LOWER(title) LIKE ?', [`%${normalizedSearch}%`]);
    }

    const [rows, countResult] = await Promise.all([
      baseQuery.clone().orderBy('title', 'asc').offset(offset).limit(limit),
      baseQuery.clone().count<{ count: string }[]>('* as count'),
    ]);

    const result: PaginationResult<RepairOrderRegion> = {
      rows,
      total: Number(countResult[0]?.count ?? 0),
      limit,
      offset,
    };

    await this.redisService.set(cacheKey, result, 3600);
    return result;
  }

  async findOne(id: string): Promise<RepairOrderRegion> {
    const cacheKey = `${this.redisByIdPrefix}${id}`;
    const cached = await this.redisService.get<RepairOrderRegion>(cacheKey);
    if (cached) {
      return cached;
    }

    const region = await this.knex<RepairOrderRegion>(this.tableName).where({ id }).first();
    if (!region) {
      throw new NotFoundException({
        message: 'Repair order region not found',
        location: 'repair_order_region_id',
      });
    }

    await this.redisService.set(cacheKey, region, 3600);
    return region;
  }

  async update(
    id: string,
    dto: UpdateRepairOrderRegionDto,
    adminId?: string,
  ): Promise<{ message: string }> {
    const trx = await this.knex.transaction();

    try {
      const existing = await this.getRegionOrThrow(trx, id);
      const updateData: Partial<RepairOrderRegion> = {
        updated_at: new Date().toISOString(),
      };

      if (dto.title !== undefined) {
        const title = this.normalizeTitle(dto.title);
        await this.ensureTitleIsUnique(trx, title, id);
        updateData.title = title;
      }

      if (dto.description !== undefined) {
        updateData.description = this.normalizeDescription(dto.description);
      }

      await trx<RepairOrderRegion>(this.tableName).where({ id: existing.id }).update(updateData);
      await this.historyService.recordEntityUpdated({
        db: trx,
        entityTable: this.tableName,
        entityPk: id,
        entityLabel: existing.title ?? null,
        actor: adminId ? { actorPk: adminId } : null,
        before: existing as unknown as Record<string, unknown>,
        after: { ...existing, ...updateData } as Record<string, unknown>,
        fields: Object.keys(dto),
      });
      await trx.commit();

      await this.invalidateCache(id);
      return { message: 'Repair order region updated successfully' };
    } catch (error) {
      await trx.rollback();

      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Failed to update repair order region ${id}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadRequestException({
        message: 'Failed to update repair order region',
        location: 'update_repair_order_region',
      });
    }
  }

  async delete(id: string, adminId?: string): Promise<{ message: string }> {
    const trx = await this.knex.transaction();

    try {
      const existing = await this.getRegionOrThrow(trx, id);

      const linkedOrder = await trx('repair_orders').where({ region_id: id }).first();
      if (linkedOrder) {
        throw new ConflictException({
          message: 'Repair order region cannot be deleted because it is used by repair orders',
          location: 'repair_order_region_id',
        });
      }

      await trx<RepairOrderRegion>(this.tableName).where({ id }).del();
      await this.historyService.recordEntityDeleted({
        db: trx,
        entityTable: this.tableName,
        entityPk: id,
        entityLabel: existing.title ?? null,
        actor: adminId ? { actorPk: adminId } : null,
        before: existing as unknown as Record<string, unknown>,
      });
      await trx.commit();

      await this.invalidateCache(id);
      return { message: 'Repair order region deleted successfully' };
    } catch (error) {
      await trx.rollback();

      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Failed to delete repair order region ${id}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadRequestException({
        message: 'Failed to delete repair order region',
        location: 'delete_repair_order_region',
      });
    }
  }

  private async getRegionOrThrow(
    knex: Knex | Knex.Transaction,
    id: string,
  ): Promise<RepairOrderRegion> {
    const region = await knex<RepairOrderRegion>(this.tableName).where({ id }).first();

    if (!region) {
      throw new NotFoundException({
        message: 'Repair order region not found',
        location: 'repair_order_region_id',
      });
    }

    return region;
  }

  private async ensureTitleIsUnique(
    knex: Knex | Knex.Transaction,
    title: string,
    excludeId?: string,
  ): Promise<void> {
    const query = knex<RepairOrderRegion>(this.tableName).andWhereRaw('LOWER(title) = LOWER(?)', [
      title,
    ]);

    if (excludeId) {
      void query.whereNot('id', excludeId);
    }

    const existing = await query.first();
    if (existing) {
      throw new BadRequestException({
        message: 'Repair order region title already exists',
        location: 'title',
      });
    }
  }

  private normalizeTitle(title: string): string {
    return title.trim();
  }

  private normalizeDescription(description?: string | null): string | null {
    if (description === undefined || description === null) {
      return null;
    }

    const normalized = description.trim();
    return normalized.length > 0 ? normalized : null;
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
