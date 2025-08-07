import { Injectable, BadRequestException, HttpException } from '@nestjs/common';
import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import { CreatePhoneCategoryDto } from './dto/create-phone-category.dto';
import { UpdatePhoneCategoryDto } from './dto/update-phone-category.dto';
import { FindAllPhoneCategoriesDto } from './dto/find-all-phone-categories.dto';
import { getNextSortValue } from 'src/common/utils/sort.util';
import { RedisService } from 'src/common/redis/redis.service';
import { PhoneOsTypesService } from 'src/phone-os-types/phone-os-types.service';
import { LoggerService } from 'src/common/logger/logger.service';
import { PhoneCategory, PhoneCategoryWithMeta } from 'src/common/types/phone-category.interface';
import { PhoneOsType } from 'src/common/types/phone-os-type.interface';

@Injectable()
export class PhoneCategoriesService {
  private readonly redisKeyCategories = 'phone_categories:';

  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly phoneOsTypesService: PhoneOsTypesService,
    private readonly redisService: RedisService,
    private readonly logger: LoggerService,
  ) {}

  async create(dto: CreatePhoneCategoryDto, adminId: string): Promise<PhoneCategory> {
    const trx = await this.knex.transaction();
    try {
      this.logger.log(`Creating phone category by admin ${adminId}`);
      const { parent_id, name_uz, name_ru, name_en, phone_os_type_id } = dto;

      if (phone_os_type_id) {
        const allOsTypes: PhoneOsType[] = await this.phoneOsTypesService.findAll();
        const found = allOsTypes.find((os) => os.id === phone_os_type_id);
        if (!found || !found.is_active) {
          throw new BadRequestException({
            message: 'Phone OS type not found or inactive',
            location: 'phone_os_type_id',
          });
        }
      }

      const existing = await trx('phone_categories')
        .whereRaw('LOWER(name_uz) = LOWER(?)', [name_uz])
        .orWhereRaw('LOWER(name_ru) = LOWER(?)', [name_ru])
        .orWhereRaw('LOWER(name_en) = LOWER(?)', [name_en])
        .andWhere('parent_id', parent_id ?? null)
        .andWhere('status', 'Open')
        .first();
      if (existing) {
        throw new BadRequestException({
          message: 'Category with the same name already exists under this parent',
          location: 'name_conflict',
        });
      }

      if (parent_id) {
        const parent = await trx('phone_categories')
          .where({ id: parent_id, is_active: true, status: 'Open' })
          .first();
        if (!parent) {
          throw new BadRequestException({
            message: 'Parent category not found or inactive',
            location: 'parent_id',
          });
        }

        const isParentBoundToProblems = await trx('phone_problem_mappings')
          .where({ phone_category_id: parent_id })
          .first();
        if (isParentBoundToProblems) {
          throw new BadRequestException({
            message: 'Cannot add child to a category already linked with problems',
            location: 'parent_id',
          });
        }
      }

      const nextSort = await getNextSortValue(trx, 'phone_categories', {
        where: { parent_id: parent_id ?? null },
      });
      const insertData: Partial<PhoneCategory> = {
        name_uz,
        name_ru,
        name_en,
        parent_id: parent_id ?? null,
        phone_os_type_id,
        sort: nextSort,
        is_active: true,
        status: 'Open',
        created_by: adminId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const [inserted]: PhoneCategory[] = await trx('phone_categories')
        .insert(insertData)
        .returning('*');
      await trx.commit();

      await Promise.all([
        this.redisService.flushByPrefix(`${this.redisKeyCategories}${parent_id || 'root'}`),
        this.redisService.flushByPrefix(`${this.redisKeyCategories}${phone_os_type_id || 'all'}`),
      ]);
      this.logger.log(`Created phone category ${inserted.id}`);
      return inserted;
    } catch (err) {
      await trx.rollback();
      if (err instanceof HttpException) {
        throw err;
      }
      this.logger.error(`Failed to create phone category`);
      throw new BadRequestException({
        message: 'Failed to create phone category',
        location: 'create_phone_category',
      });
    }
  }

  async findWithParentOrRoot(query: FindAllPhoneCategoriesDto): Promise<PhoneCategoryWithMeta[]> {
    return this.findPhoneCategories(query);
  }

  async findPhoneCategories(
    query: Omit<FindAllPhoneCategoriesDto, 'parent_id'> & { parent_id?: string },
  ): Promise<PhoneCategoryWithMeta[]> {
    const { phone_os_type_id, limit = 20, offset = 0, search, parent_id } = query;
    const cacheKey = `${this.redisKeyCategories}${parent_id || 'root'}:${phone_os_type_id || 'all'}:${search || 'none'}:${offset}:${limit}`;
    const cached: PhoneCategoryWithMeta[] | null = await this.redisService.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for phone categories: ${cacheKey}`);
      return cached;
    }

    const trx = await this.knex.transaction();
    try {
      const q = trx('phone_categories as pc')
        .where({ 'pc.is_active': true, 'pc.status': 'Open' })
        .andWhere(parent_id ? { 'pc.parent_id': parent_id } : { 'pc.parent_id': null })
        .select(
          'pc.*',
          trx.raw(`EXISTS (
            SELECT 1 FROM phone_categories c
            WHERE c.parent_id = pc.id AND c.is_active = true AND c.status = 'Open'
          ) as has_children`),
          trx.raw(`EXISTS (
            SELECT 1 FROM phone_problem_mappings ppm
            JOIN problem_categories p ON p.id = ppm.problem_category_id
            WHERE ppm.phone_category_id = pc.id AND p.status = 'Open'
          ) as has_problems`),
          parent_id
            ? trx.raw(
                `(
                  WITH RECURSIVE breadcrumb AS (
                    SELECT id, name_uz, name_ru, name_en, parent_id, sort
                    FROM phone_categories
                    WHERE id = ?
                    UNION ALL
                    SELECT c.id, c.name_uz, c.name_ru, c.name_en, c.parent_id, c.sort
                    FROM phone_categories c
                    JOIN breadcrumb b ON b.parent_id = c.id
                    WHERE c.is_active = true AND c.status = 'Open'
                  )
                  SELECT COALESCE(JSON_AGG(breadcrumb ORDER BY sort), '[]') FROM breadcrumb
                ) as breadcrumb`,
                [parent_id],
              )
            : trx.raw(`'[]'::jsonb as breadcrumb`),
        );

      if (phone_os_type_id) void q.andWhere('pc.phone_os_type_id', phone_os_type_id);
      if (search) {
        void q.andWhere(
          (builder: Knex.QueryBuilder) =>
            void builder
              .whereILike('pc.name_uz', `%${search}%`)
              .orWhereILike('pc.name_ru', `%${search}%`)
              .orWhereILike('pc.name_en', `%${search}%`),
        );
      }

      const result: PhoneCategoryWithMeta[] = await q
        .orderBy('pc.sort', 'asc')
        .offset(offset)
        .limit(limit);
      await trx.commit();

      await this.redisService.set(cacheKey, result, 3600);
      this.logger.log(`Fetched ${result.length} phone categories`);
      return result;
    } catch (err) {
      await trx.rollback();
      if (err instanceof HttpException) {
        throw err;
      }
      this.logger.error(`Failed to fetch phone categories`);
      throw new BadRequestException({
        message: 'Failed to fetch phone categories',
        location: 'find_phone_categories',
      });
    }
  }

  async update(id: string, dto: UpdatePhoneCategoryDto): Promise<{ message: string }> {
    const trx = await this.knex.transaction();
    try {
      this.logger.log(`Updating phone category ${id}`);
      const category: PhoneCategory | undefined = await trx('phone_categories')
        .where({ id, status: 'Open' })
        .first();
      if (!category) {
        throw new BadRequestException({
          message: 'Phone category not found or inactive',
          location: 'id',
        });
      }

      let parentId = dto.parent_id ?? category.parent_id;
      if (typeof parentId === 'string' && parentId.trim() === '') parentId = null;

      if (id === parentId) {
        throw new BadRequestException({
          message: 'Category cannot be its own parent',
          location: 'parent_id',
        });
      }

      if (dto.name_uz || dto.name_ru || dto.name_en) {
        const existing = await trx('phone_categories')
          .whereRaw('LOWER(name_uz) = LOWER(?)', [dto.name_uz ?? category.name_uz])
          .orWhereRaw('LOWER(name_ru) = LOWER(?)', [dto.name_ru ?? category.name_ru])
          .orWhereRaw('LOWER(name_en) = LOWER(?)', [dto.name_en ?? category.name_en])
          .andWhere('parent_id', parentId ?? null)
          .andWhere('status', 'Open')
          .andWhereNot('id', id)
          .first();
        if (existing) {
          throw new BadRequestException({
            message: 'Category with the same name already exists under this parent',
            location: 'name_conflict',
          });
        }
      }

      if (parentId) {
        const parent = await trx('phone_categories')
          .where({ id: parentId, is_active: true, status: 'Open' })
          .first();
        if (!parent) {
          throw new BadRequestException({
            message: 'Parent category not found or inactive',
            location: 'parent_id',
          });
        }

        const isParentBoundToProblems = await trx('phone_problem_mappings')
          .where({ phone_category_id: parentId })
          .first();
        if (isParentBoundToProblems) {
          throw new BadRequestException({
            message: 'Cannot add child to a category already linked with problems',
            location: 'parent_id',
          });
        }
      }

      if (dto.phone_os_type_id) {
        const allOsTypes = await this.phoneOsTypesService.findAll();
        const found = allOsTypes.find((os) => os.id === dto.phone_os_type_id);
        if (!found || !found.is_active) {
          throw new BadRequestException({
            message: 'Phone OS type not found or inactive',
            location: 'phone_os_type_id',
          });
        }
      }

      const updateData: Partial<PhoneCategory> = {
        name_uz: dto.name_uz,
        name_ru: dto.name_ru,
        name_en: dto.name_en,
        parent_id: parentId,
        phone_os_type_id: dto.phone_os_type_id,
        updated_at: new Date().toISOString(),
      };

      await trx('phone_categories').where({ id }).update(updateData);
      await trx.commit();

      await Promise.all([
        this.redisService.flushByPrefix(
          `${this.redisKeyCategories}${parentId || category.parent_id || 'root'}`,
        ),
        this.redisService.flushByPrefix(
          `${this.redisKeyCategories}${dto.phone_os_type_id || category.phone_os_type_id || 'all'}`,
        ),
      ]);
      this.logger.log(`Updated phone category ${id}`);
      return { message: 'Phone category updated successfully' };
    } catch (err) {
      await trx.rollback();
      if (err instanceof HttpException) {
        throw err;
      }
      this.logger.error(`Failed to update phone category ${id}`);
      throw new BadRequestException({
        message: 'Failed to update phone category',
        location: 'update_phone_category',
      });
    }
  }

  async updateSort(id: string, newSort: number): Promise<{ message: string }> {
    const trx = await this.knex.transaction();
    try {
      this.logger.log(`Updating sort for phone category ${id} to ${newSort}`);
      const category: PhoneCategory | undefined = await trx('phone_categories')
        .where({ id, status: 'Open' })
        .first();
      if (!category) {
        throw new BadRequestException({
          message: 'Phone category not found or inactive',
          location: 'id',
        });
      }

      if (newSort === category.sort) {
        await trx.commit();
        return { message: 'No change needed' };
      }

      if (newSort < category.sort) {
        await trx('phone_categories')
          .where({ parent_id: category.parent_id ?? null })
          .andWhere('sort', '>=', newSort)
          .andWhere('sort', '<', category.sort)
          .update({ sort: trx.raw('sort + 1') });
      } else {
        await trx('phone_categories')
          .where({ parent_id: category.parent_id ?? null })
          .andWhere('sort', '<=', newSort)
          .andWhere('sort', '>', category.sort)
          .update({ sort: trx.raw('sort - 1') });
      }

      await trx('phone_categories').where({ id }).update({ sort: newSort, updated_at: new Date() });
      await trx.commit();

      await this.redisService.flushByPrefix(
        `${this.redisKeyCategories}${category.parent_id || 'root'}`,
      );
      return { message: 'Sort updated successfully' };
    } catch (err) {
      await trx.rollback();
      if (err instanceof HttpException) {
        throw err;
      }
      this.logger.error(`Failed to update sort for phone category ${id}`);
      throw new BadRequestException({ message: 'Failed to update sort', location: 'update_sort' });
    }
  }

  async delete(id: string): Promise<{ message: string }> {
    const trx = await this.knex.transaction();
    try {
      const category = await trx('phone_categories').where({ id, status: 'Open' }).first();
      if (!category) {
        throw new BadRequestException({
          message: 'Phone category not found or already deleted',
          location: 'id',
        });
      }

      const hasChildren = await trx('phone_categories')
        .where({ parent_id: id, status: 'Open' })
        .first();
      if (hasChildren) {
        throw new BadRequestException({
          message: 'Cannot delete category with child categories',
          location: 'has_children',
        });
      }

      const hasProblems = await trx('phone_problem_mappings')
        .where({ phone_category_id: id })
        .first();
      if (hasProblems) {
        throw new BadRequestException({
          message: 'Cannot delete category with linked problems',
          location: 'has_problems',
        });
      }

      await trx('phone_categories')
        .where({ id })
        .update({ status: 'Deleted', updated_at: new Date() });
      await trx.commit();

      await this.redisService.flushByPrefix(
        `${this.redisKeyCategories}${category.parent_id || 'root'}`,
      );
      if (category.phone_os_type_id) {
        await this.redisService.flushByPrefix(
          `${this.redisKeyCategories}${category.phone_os_type_id}`,
        );
      }
      return { message: 'Phone category deleted successfully' };
    } catch (err) {
      await trx.rollback();
      if (err instanceof HttpException) {
        throw err;
      }
      this.logger.error(`Failed to delete phone category ${id}`);
      throw new BadRequestException({
        message: 'Failed to delete phone category',
        location: 'delete_phone_category',
      });
    }
  }
}
