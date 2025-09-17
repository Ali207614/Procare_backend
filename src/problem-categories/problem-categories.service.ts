import { Injectable, BadRequestException, NotFoundException, HttpException } from '@nestjs/common';
import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import { CreateProblemCategoryDto } from './dto/create-problem-category.dto';
import { UpdateProblemCategoryDto } from './dto/update-problem-category.dto';
import { FindAllProblemCategoriesDto } from './dto/find-all-problem-categories.dto';
import { getNextSortValue } from 'src/common/utils/sort.util';
import { RedisService } from 'src/common/redis/redis.service';
import { LoggerService } from 'src/common/logger/logger.service';
import {
  ProblemCategory,
  ProblemCategoryWithMeta,
} from 'src/common/types/problem-category.interface';
import { PhoneCategory } from 'src/common/types/phone-category.interface';
import { PaginationResult } from 'src/common/utils/pagination.util';

@Injectable()
export class ProblemCategoriesService {
  private readonly redisKeyRoot = 'problem_categories:root:';
  private readonly redisKeyChildren = 'problem_categories:children:';
  private readonly redisKeyAll = 'problem_categories:';

  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly redisService: RedisService,
    private readonly logger: LoggerService,
  ) {}

  async create(dto: CreateProblemCategoryDto, adminId: string): Promise<ProblemCategory> {
    const trx = await this.knex.transaction();
    try {
      const { parent_id, name_uz, name_ru, name_en, phone_category_id, price, estimated_minutes } =
        dto;

      if (parent_id && phone_category_id) {
        throw new BadRequestException({
          message: 'Cannot provide both parent_id and phone_category_id',
          location: 'conflict_parent_and_phone',
        });
      }

      if (!parent_id && !phone_category_id) {
        throw new BadRequestException({
          message: 'phone_category_id is required for root-level problems',
          location: 'phone_category_id',
        });
      }

      if (parent_id) {
        const parent = await trx('problem_categories')
          .where({ id: parent_id, status: 'Open', is_active: true })
          .first();
        if (!parent) {
          throw new BadRequestException({
            message: 'Parent problem category not found or inactive',
            location: 'parent_id',
          });
        }

        const existing = await trx('problem_categories')
          .where({ parent_id, status: 'Open' })
          .andWhere((qb: Knex.QueryBuilder) => {
            void qb
              .whereRaw('LOWER(name_uz) = LOWER(?)', [name_uz])
              .orWhereRaw('LOWER(name_ru) = LOWER(?)', [name_ru])
              .orWhereRaw('LOWER(name_en) = LOWER(?)', [name_en]);
          })
          .first();
        if (existing) {
          throw new BadRequestException({
            message: 'Problem with same name already exists under this parent',
            location: 'name_conflict',
          });
        }
      }

      if (phone_category_id) {
        const isParent: PhoneCategory | undefined = await trx<PhoneCategory>('phone_categories')
          .where({ parent_id: phone_category_id, status: 'Open', is_active: true })
          .first();
        if (isParent) {
          throw new BadRequestException({
            message: 'Cannot assign problem to a phone category with children',
            location: 'phone_category_id',
          });
        }

        const existing = await trx('problem_categories as p')
          .join('phone_problem_mappings as ppm', 'ppm.problem_category_id', 'p.id')
          .where({
            'p.parent_id': null,
            'ppm.phone_category_id': phone_category_id,
            'p.status': 'Open',
            'p.is_active': true,
          })
          .andWhere((qb: Knex.QueryBuilder) => {
            void qb
              .whereRaw('LOWER(p.name_uz) = LOWER(?)', [name_uz])
              .orWhereRaw('LOWER(p.name_ru) = LOWER(?)', [name_ru])
              .orWhereRaw('LOWER(p.name_en) = LOWER(?)', [name_en]);
          })
          .first();
        if (existing) {
          throw new BadRequestException({
            message: 'Problem with same name already exists for this phone category',
            location: 'name_conflict',
          });
        }
      }

      const nextSort = await getNextSortValue(trx, 'problem_categories');
      const insertData: Partial<ProblemCategory> = {
        name_uz,
        name_ru,
        name_en,
        parent_id: parent_id ?? null,
        price: price ? String(price) : '0',
        estimated_minutes: estimated_minutes ?? 0,
        sort: nextSort,
        is_active: true,
        status: 'Open',
        created_by: adminId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const [problem]: ProblemCategory[] = await trx('problem_categories')
        .insert(insertData)
        .returning('*');
      if (phone_category_id) {
        await trx('phone_problem_mappings').insert({
          phone_category_id,
          problem_category_id: problem.id,
        });
      }

      await trx.commit();

      await this.redisService.flushByPrefix(this.redisKeyAll);
      return problem;
    } catch (err) {
      await trx.rollback();
      if (err instanceof HttpException) {
        throw err;
      }
      this.logger.error(`Failed to create problem category`);
      throw new BadRequestException({
        message: 'Failed to create problem category',
        location: 'create_problem_category',
      });
    }
  }

  async findRootProblems(
    query: FindAllProblemCategoriesDto,
  ): Promise<PaginationResult<ProblemCategoryWithMeta>> {
    const { phone_category_id, search, limit = 20, offset = 0 } = query;
    if (!phone_category_id) {
      throw new BadRequestException({
        message: 'phone_category_id is required for root-level problems',
        location: 'phone_category_id',
      });
    }

    const cacheKey = `${this.redisKeyRoot}${phone_category_id}:${search ?? 'none'}:${offset}:${limit}`;
    const cached: PaginationResult<ProblemCategoryWithMeta> | null =
      await this.redisService.get<PaginationResult<ProblemCategoryWithMeta>>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for root problems: ${cacheKey}`);
      return cached;
    }

    const trx = await this.knex.transaction();
    try {
      const applyFilters = (query: Knex.QueryBuilder): void => {
        if (search?.trim()) {
          const searchTerm = `%${search.toLowerCase()}%`;
          void query.andWhere(
            (builder) =>
              void builder
                .whereRaw('LOWER(pc.name_uz) LIKE ?', [searchTerm])
                .orWhereRaw('LOWER(pc.name_ru) LIKE ?', [searchTerm])
                .orWhereRaw('LOWER(pc.name_en) LIKE ?', [searchTerm]),
          );
        }
      };

      const baseQuery = trx('problem_categories as p')
        .select(
          'p.*',
          trx.raw(`EXISTS (
          SELECT 1 FROM problem_categories c
          WHERE c.parent_id = p.id AND c.status = 'Open' 
        ) as has_children`),
          trx.raw(`'[]'::json as breadcrumb`),
        )
        .leftJoin('phone_problem_mappings as ppm', 'ppm.problem_category_id', 'p.id')
        .where({
          'ppm.phone_category_id': phone_category_id,
          'p.parent_id': null,
          'p.status': 'Open',
        });

      applyFilters(baseQuery);

      const countQuery = trx('problem_categories as p')
        .leftJoin('phone_problem_mappings as ppm', 'ppm.problem_category_id', 'p.id')
        .where({
          'ppm.phone_category_id': phone_category_id,
          'p.parent_id': null,
          'p.status': 'Open',
        });

      applyFilters(countQuery);

      const [rows, [{ count }]] = await Promise.all([
        baseQuery.clone().orderBy('p.sort', 'asc').offset(offset).limit(limit),
        countQuery.count<{ count: string }[]>('* as count'),
      ]);

      await trx.commit();

      const result: PaginationResult<ProblemCategoryWithMeta> = {
        rows,
        total: Number(count),
        limit,
        offset,
      };

      await this.redisService.set(cacheKey, result, 3600);
      return result;
    } catch (err) {
      await trx.rollback();
      this.logger.error(`Failed to fetch root problems`);
      if (err instanceof HttpException) throw err;
      throw new BadRequestException({
        message: 'Failed to fetch root problems',
        location: 'find_root_problems',
      });
    }
  }

  async findChildrenWithBreadcrumb(
    query: FindAllProblemCategoriesDto,
  ): Promise<PaginationResult<ProblemCategoryWithMeta>> {
    const { parent_id, search, limit = 20, offset = 0 } = query;
    if (!parent_id) {
      throw new BadRequestException({
        message: 'parent_id is required for child problems',
        location: 'parent_id',
      });
    }

    const cacheKey = `${this.redisKeyChildren}${parent_id}:${search ?? 'none'}:${offset}:${limit}`;
    const cached: PaginationResult<ProblemCategoryWithMeta> | null =
      await this.redisService.get<PaginationResult<ProblemCategoryWithMeta>>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for child problems: ${cacheKey}`);
      return cached;
    }

    const trx = await this.knex.transaction();
    try {
      const applyFilters = (query: Knex.QueryBuilder): void => {
        if (search?.trim()) {
          const searchTerm = `%${search.toLowerCase()}%`;

          void query.andWhere(
            (builder) =>
              void builder
                .whereRaw('LOWER(pc.name_uz) LIKE ?', [searchTerm])
                .orWhereRaw('LOWER(pc.name_ru) LIKE ?', [searchTerm])
                .orWhereRaw('LOWER(pc.name_en) LIKE ?', [searchTerm]),
          );
        }
      };

      const baseQuery = trx('problem_categories as p')
        .select(
          'p.*',
          trx.raw(`EXISTS (
          SELECT 1 FROM problem_categories c
          WHERE c.parent_id = p.id AND c.status = 'Open'
        ) as has_children`),
          trx.raw(
            `(
            WITH RECURSIVE breadcrumb AS (
              SELECT id, name_uz, name_ru, name_en, parent_id, sort, 1 as depth
              FROM problem_categories
              WHERE id = ?
              UNION ALL
              SELECT c.id, c.name_uz, c.name_ru, c.name_en, c.parent_id, c.sort, b.depth + 1
              FROM problem_categories c
              JOIN breadcrumb b ON b.parent_id = c.id
              WHERE c.status = 'Open' 
            )
            SELECT COALESCE(JSON_AGG(row_to_json(breadcrumb) ORDER BY depth DESC), '[]'::json) FROM breadcrumb
          ) as breadcrumb`,
            [parent_id],
          ),
        )
        .where({ 'p.parent_id': parent_id, 'p.status': 'Open' });

      applyFilters(baseQuery);

      const countQuery = trx('problem_categories as p').where({
        'p.parent_id': parent_id,
        'p.status': 'Open',
      });

      applyFilters(countQuery);

      const [rows, [{ count }]] = await Promise.all([
        baseQuery.clone().orderBy('p.sort', 'asc').offset(offset).limit(limit),
        countQuery.count<{ count: string }[]>('* as count'),
      ]);

      await trx.commit();

      const result: PaginationResult<ProblemCategoryWithMeta> = {
        rows,
        total: Number(count),
        limit,
        offset,
      };

      await this.redisService.set(cacheKey, result, 3600);
      return result;
    } catch (err) {
      await trx.rollback();
      this.logger.error(`Failed to fetch child problems: `);
      if (err instanceof HttpException) throw err;
      throw new BadRequestException({
        message: 'Failed to fetch child problems',
        location: 'find_children_with_breadcrumb',
      });
    }
  }

  async update(id: string, dto: UpdateProblemCategoryDto): Promise<{ message: string }> {
    const trx = await this.knex.transaction();
    try {
      const category = await trx('problem_categories').where({ id, status: 'Open' }).first();
      if (!category) {
        throw new BadRequestException({
          message: 'Problem category not found or inactive',
          location: 'id',
        });
      }

      const { name_uz, name_ru, name_en } = dto;

      const parentId: string | null = category.parent_id;
      if (name_uz || name_ru || name_en) {
        const conflictQuery = trx('problem_categories')
          .whereNot({ id })
          .andWhere({ status: 'Open' })
          .andWhere((qb) => {
            if (name_uz) void qb.orWhereRaw('LOWER(name_uz) = LOWER(?)', [name_uz]);
            if (name_ru) void qb.orWhereRaw('LOWER(name_ru) = LOWER(?)', [name_ru]);
            if (name_en) void qb.orWhereRaw('LOWER(name_en) = LOWER(?)', [name_en]);
          });

        if (parentId) {
          void conflictQuery.andWhere({ parent_id: parentId });
        } else {
          void conflictQuery.andWhere({ parent_id: null });
        }

        const conflict = await conflictQuery.first();
        if (conflict) {
          throw new BadRequestException({
            message: 'Problem with same name already exists',
            location: 'name_conflict',
          });
        }
      }

      const updateData = {
        name_uz: dto.name_uz ?? category.name_uz,
        name_ru: dto.name_ru ?? category.name_ru,
        name_en: dto.name_en ?? category.name_en,
        price: dto.price ?? category.price,
        is_active: dto.is_active ?? category.is_active,
        estimated_minutes: dto.estimated_minutes ?? category.estimated_minutes,
        updated_at: this.knex.fn.now(),
      };

      await trx('problem_categories').where({ id }).update(updateData);

      await trx.commit();

      await this.redisService.flushByPrefix(this.redisKeyAll);

      return { message: 'Problem category updated successfully' };
    } catch (err) {
      await trx.rollback();
      this.logger.error(`Failed to update problem category ${id}:`);
      if (err instanceof HttpException) throw err;
      throw new BadRequestException({
        message: 'Failed to update problem category',
        location: 'update_problem_category',
      });
    }
  }

  async updateSort(id: string, newSort: number): Promise<{ message: string }> {
    const trx = await this.knex.transaction();
    try {
      const category: ProblemCategory | undefined = await trx('problem_categories')
        .where({ id, status: 'Open' })
        .first();
      if (!category) {
        throw new BadRequestException({
          message: 'Problem category not found or inactive',
          location: 'id',
        });
      }

      if (newSort === category.sort) {
        await trx.commit();
        return { message: 'No change needed' };
      }

      if (newSort < category.sort) {
        await trx('problem_categories')
          .where({ parent_id: category.parent_id ?? null })
          .andWhere('sort', '>=', newSort)
          .andWhere('sort', '<', category.sort)
          .update({ sort: this.knex.raw('sort + 1') });
      } else {
        await trx('problem_categories')
          .where({ parent_id: category.parent_id ?? null })
          .andWhere('sort', '<=', newSort)
          .andWhere('sort', '>', category.sort)
          .update({ sort: this.knex.raw('sort - 1') });
      }

      await trx('problem_categories')
        .where({ id })
        .update({ sort: newSort, updated_at: new Date().toISOString() });
      await trx.commit();
      await this.redisService.flushByPrefix(this.redisKeyAll);

      return { message: 'Sort updated successfully' };
    } catch (err) {
      await trx.rollback();
      if (err instanceof HttpException) {
        throw err;
      }
      this.logger.error(`Failed to update sort for problem category ${id}`);
      throw new BadRequestException({
        message: 'Failed to update sort',
        location: 'update_sort',
      });
    }
  }

  async delete(id: string): Promise<{ message: string }> {
    const trx = await this.knex.transaction();
    try {
      const category: ProblemCategory | undefined = await trx('problem_categories')
        .where({ id, status: 'Open' })
        .first();

      if (!category) {
        throw new NotFoundException({
          message: 'Problem category not found or already deleted',
          location: 'id',
        });
      }

      const hasChildren: ProblemCategory | undefined = await trx('problem_categories')
        .where({ parent_id: id, status: 'Open' })
        .first();

      if (hasChildren) {
        throw new BadRequestException({
          message: 'Cannot delete category with child problems',
          location: 'has_children',
        });
      }

      if (category.parent_id === null) {
        await trx('phone_problem_mappings').where({ problem_category_id: id }).del();
      }

      await trx('problem_categories')
        .where({ id })
        .update({ status: 'Deleted', updated_at: new Date().toISOString() });

      await trx.commit();

      await this.redisService.flushByPrefix(this.redisKeyAll);

      return { message: 'Problem category deleted successfully' };
    } catch (err) {
      await trx.rollback();
      if (err instanceof HttpException) {
        throw err;
      }
      this.logger.error(`Failed to delete problem category ${id}`);
      throw new BadRequestException({
        message: 'Failed to delete problem category',
        location: 'delete_problem_category',
      });
    }
  }
}
