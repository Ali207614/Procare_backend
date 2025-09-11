import { BadRequestException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { Knex } from 'knex';
import { InjectKnex } from 'nestjs-knex';
import { RedisService } from 'src/common/redis/redis.service';
import { CreatePhoneOsTypeDto } from './dto/create-phone-os-type.dto';
import { UpdatePhoneOsTypeDto } from './dto/update-phone-os-type.dto';
import { PhoneOsType } from 'src/common/types/phone-os-type.interface';
import { LoggerService } from 'src/common/logger/logger.service';
import { PaginationResult } from 'src/common/utils/pagination.util';
import { FindAllPhoneOsTypeDto } from 'src/phone-os-types/dto/find-all-phone-os-type.dto';

@Injectable()
export class PhoneOsTypesService {
  private readonly redisKey = 'phone_os_types:all';

  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly redisService: RedisService,
    private readonly logger: LoggerService,
  ) {}

  async create(dto: CreatePhoneOsTypeDto, adminId: string): Promise<PhoneOsType> {
    const trx = await this.knex.transaction();
    try {
      const { name_uz, name_ru, name_en } = dto;

      if (name_uz || name_ru || name_en) {
        const conflictQuery = trx('phone_os_types')
          .where({ status: 'Open' })
          .andWhere((qb) => {
            if (name_uz) void qb.orWhere('name_uz', name_uz);
            if (name_ru) void qb.orWhere('name_ru', name_ru);
            if (name_en) void qb.orWhere('name_en', name_en);
          });

        const conflict = await conflictQuery.first();
        if (conflict) {
          throw new BadRequestException({
            message: 'OS type with same name already exists',
            location: 'name_conflict',
          });
        }
      }

      if (name_uz?.trim() === '' || name_ru?.trim() === '' || name_en?.trim() === '') {
        throw new BadRequestException({
          message: 'Names cannot be empty or whitespace',
          location: 'name_validation',
        });
      }

      const insertData = {
        name_uz,
        name_ru,
        name_en,
        created_by: adminId,
        status: 'Open',
        created_at: trx.fn.now(),
      };

      const inserted: PhoneOsType[] = await trx('phone_os_types').insert(insertData).returning('*');

      await this.redisService.del(this.redisKey), await trx.commit();

      return inserted[0];
    } catch (err) {
      await trx.rollback();
      this.logger.error(`Failed to create phone OS type: `);
      if (err instanceof HttpException) throw err;
      throw new BadRequestException({
        message: 'Failed to create phone OS type',
        location: 'create_phone_os_type',
      });
    }
  }

  async findAll(query: FindAllPhoneOsTypeDto = {}): Promise<PaginationResult<PhoneOsType>> {
    const { limit = 20, offset = 0 } = query;

    const cacheKey = `${this.redisKey}:${offset}:${limit}`;
    const cached: PaginationResult<PhoneOsType> | null =
      await this.redisService.get<PaginationResult<PhoneOsType>>(cacheKey);
    if (cached) {
      return cached;
    }

    const trx = await this.knex.transaction();
    try {
      const baseQuery = trx<PhoneOsType>('phone_os_types').where({
        is_active: true,
        status: 'Open',
      });

      const [rows, [{ count }]] = await Promise.all([
        baseQuery.clone().orderBy('sort', 'asc').offset(offset).limit(limit),
        baseQuery.clone().count<{ count: string }[]>('* as count'),
      ]);

      const result: PaginationResult<PhoneOsType> = {
        rows,
        total: Number(count),
        limit,
        offset,
      };

      await this.redisService.set(cacheKey, result, 3600);
      await trx.commit();

      return result;
    } catch (err) {
      await trx.rollback();
      this.logger.error(`Failed to fetch phone OS types: `);
      if (err instanceof HttpException) throw err;
      throw new BadRequestException({
        message: 'Failed to fetch phone OS types',
        location: 'find_all_phone_os_types',
      });
    } finally {
      await trx.destroy();
    }
  }

  async update(id: string, dto: UpdatePhoneOsTypeDto): Promise<{ message: string }> {
    const trx = await this.knex.transaction();
    try {
      const exists: PhoneOsType | undefined = await trx<PhoneOsType>('phone_os_types')
        .where({ id, status: 'Open' })
        .first();

      if (!exists) {
        throw new NotFoundException({
          message: 'OS type not found or inactive',
          location: 'id',
        });
      }

      const { name_uz, name_ru, name_en } = dto;

      if (name_uz || name_ru || name_en) {
        const conflictQuery = trx('phone_os_types')
          .whereNot({ id })
          .andWhere({ status: 'Open' })
          .andWhere((qb) => {
            if (name_uz) void qb.orWhere('name_uz', name_uz);
            if (name_ru) void qb.orWhere('name_ru', name_ru);
            if (name_en) void qb.orWhere('name_en', name_en);
          });

        const conflict = await conflictQuery.first();
        if (conflict) {
          throw new BadRequestException({
            message: 'OS type with same name already exists',
            location: 'name_conflict',
          });
        }
      }

      const updateData = {
        name_uz,
        name_ru,
        name_en,
        updated_at: trx.fn.now(),
      };

      await trx('phone_os_types').where({ id }).update(updateData);

      await this.redisService.del(this.redisKey), await trx.commit();

      return { message: 'Phone OS type updated successfully' };
    } catch (err) {
      await trx.rollback();
      this.logger.error(`Failed to update phone OS type ${id}:`);
      if (err instanceof HttpException) throw err;
      throw new BadRequestException({
        message: 'Failed to update phone OS type',
        location: 'update_phone_os_type',
      });
    } finally {
      await trx.destroy();
    }
  }

  async delete(id: string): Promise<{ message: string }> {
    const trx = await this.knex.transaction();
    try {
      const exists: PhoneOsType | undefined = await trx<PhoneOsType>('phone_os_types')
        .where({ id, status: 'Open' })
        .first();

      if (!exists) {
        throw new NotFoundException({
          message: 'OS type not found or already deleted',
          location: 'id',
        });
      }

      const relatedCategories = await trx('phone_categories')
        .where({ phone_os_type_id: id, status: 'Open' })
        .first();

      if (relatedCategories) {
        throw new BadRequestException({
          message: 'Cannot delete OS type because it has associated active phone categories',
          location: 'phone_os_type_id',
        });
      }

      await trx('phone_os_types')
        .where({ id })
        .update({ status: 'Deleted', updated_at: trx.fn.now() });

      await trx.commit();

      await this.redisService.del(this.redisKey);

      return { message: 'Phone OS type deleted (soft) successfully' };
    } catch (err) {
      await trx.rollback();
      this.logger.error(`Failed to delete phone OS type ${id}:`);
      if (err instanceof HttpException) throw err;
      throw new BadRequestException({
        message: 'Failed to delete phone OS type',
        location: 'delete_phone_os_type',
      });
    } finally {
      await trx.destroy();
    }
  }
}
