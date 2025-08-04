import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
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

@Injectable()
export class ProblemCategoriesService {
  private readonly redisKeyRoot = 'problem_categories:root:';
  private readonly redisKeyChildren = 'problem_categories:children:';

  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly redisService: RedisService,
    private readonly logger: LoggerService,
  ) {}

  async create(dto: CreateProblemCategoryDto, adminId: string): Promise<ProblemCategory> {
    const trx = await this.knex.transaction();
    try {
      this.logger.log(`Creating problem category by admin ${adminId}`);
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
            message: 'Parent problem category not found',
            location: 'parent_id',
          });
        }

        const existing = await trx('problem_categories')
          .where({ parent_id })
          .andWhere(
            (qb: Knex.QueryBuilder) =>
              void qb
                .where('name_uz', name_uz)
                .orWhere('name_ru', name_ru)
                .orWhere('name_en', name_en),
          )
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
          .where({ parent_id: phone_category_id, status: 'Open' })
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
            'p.is_active': true,
            'p.status': 'Open',
          })
          .andWhere(
            (qb: Knex.QueryBuilder) =>
              void qb
                .where('p.name_uz', name_uz)
                .orWhere('p.name_ru', name_ru)
                .orWhere('p.name_en', name_en),
          )
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
      await Promise.all([
        phone_category_id
          ? this.redisService.flushByPrefix(`${this.redisKeyRoot}${phone_category_id}`)
          : Promise.resolve(),
        parent_id
          ? this.redisService.flushByPrefix(`${this.redisKeyChildren}${parent_id}`)
          : Promise.resolve(),
      ]);
      this.logger.log(`Created problem category ${problem.id}`);
      return problem;
    } catch (err) {
      await trx.rollback();
      this.logger.error(`Failed to create problem category`);
      throw new BadRequestException({
        message: 'Failed to create problem category',
        location: 'create_problem_category',
      });
    }
  }

  async findRootProblems(query: FindAllProblemCategoriesDto): Promise<ProblemCategoryWithMeta[]> {
    const { phone_category_id, search, limit = 20, offset = 0 } = query;
    if (!phone_category_id) {
      throw new BadRequestException({
        message: 'phone_category_id is required for root-level problems',
        location: 'phone_category_id',
      });
    }

    const cacheKey = `${this.redisKeyRoot}${phone_category_id}:${search || 'none'}:${offset}:${limit}`;
    const cached: ProblemCategoryWithMeta[] | null = await this.redisService.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for root problems: ${cacheKey}`);
      return cached;
    }

    const problems: ProblemCategoryWithMeta[] = await this.knex('problem_categories as p')
      .select(
        'p.*',
        this.knex.raw(`EXISTS (
          SELECT 1 FROM problem_categories c
          WHERE c.parent_id = p.id AND c.status = 'Open' AND c.is_active = true
        ) as has_children`),
        this.knex.raw(`'[]'::json as breadcrumb`),
      )
      .join('phone_problem_mappings as ppm', 'ppm.problem_category_id', 'p.id')
      .where({
        'ppm.phone_category_id': phone_category_id,
        'p.parent_id': null,
        'p.status': 'Open',
        'p.is_active': true,
      })
      .modify((qb) => {
        if (search) {
          void qb.andWhere(
            (builder: Knex.QueryBuilder) =>
              void builder
                .whereILike('p.name_uz', `%${search}%`)
                .orWhereILike('p.name_ru', `%${search}%`)
                .orWhereILike('p.name_en', `%${search}%`),
          );
        }
      })
      .orderBy('p.sort', 'asc')
      .offset(offset)
      .limit(limit);

    await this.redisService.set(cacheKey, problems, 3600);
    this.logger.log(
      `Fetched ${problems.length} root problems for phone category ${phone_category_id}`,
    );
    return problems;
  }

  async findChildrenWithBreadcrumb(
    query: FindAllProblemCategoriesDto,
  ): Promise<ProblemCategoryWithMeta[]> {
    const { parent_id, search, limit = 20, offset = 0 } = query;
    if (!parent_id) {
      throw new BadRequestException({
        message: 'parent_id is required for child problems',
        location: 'parent_id',
      });
    }

    const cacheKey = `${this.redisKeyChildren}${parent_id}:${search || 'none'}:${offset}:${limit}`;
    const cached: ProblemCategoryWithMeta[] | null = await this.redisService.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for child problems: ${cacheKey}`);
      return cached;
    }

    const problems: ProblemCategoryWithMeta[] = await this.knex('problem_categories as p')
      .select(
        'p.*',
        this.knex.raw(`EXISTS (
          SELECT 1 FROM problem_categories c
          WHERE c.parent_id = p.id AND c.status = 'Open' AND c.is_active = true
        ) as has_children`),
        this.knex.raw(
          `(
            WITH RECURSIVE breadcrumb AS (
              SELECT id, name_uz, name_ru, name_en, parent_id, sort
              FROM problem_categories
              WHERE id = ?
              UNION ALL
              SELECT c.id, c.name_uz, c.name_ru, c.name_en, c.parent_id, c.sort
              FROM problem_categories c
              JOIN breadcrumb b ON b.parent_id = c.id
              WHERE c.status = 'Open' AND c.is_active = true
            )
            SELECT COALESCE(JSON_AGG(breadcrumb ORDER BY sort), '[]') FROM breadcrumb
          ) as breadcrumb`,
          [parent_id],
        ),
      )
      .where({ 'p.parent_id': parent_id, 'p.status': 'Open', 'p.is_active': true })
      .modify((qb) => {
        if (search) {
          void qb.andWhere(
            (builder: Knex.QueryBuilder) =>
              void builder
                .whereILike('p.name_uz', `%${search}%`)
                .orWhereILike('p.name_ru', `%${search}%`)
                .orWhereILike('p.name_en', `%${search}%`),
          );
        }
      })
      .orderBy('p.sort', 'asc')
      .offset(offset)
      .limit(limit);

    if (!problems.length) {
      throw new NotFoundException({
        message: 'Problem category not found or has no children',
        location: 'parent_id',
      });
    }

    await this.redisService.set(cacheKey, problems, 3600);
    this.logger.log(`Fetched ${problems.length} child problems for parent ${parent_id}`);
    return problems;
  }

  async update(id: string, dto: UpdateProblemCategoryDto): Promise<{ message: string }> {
    const trx = await this.knex.transaction();
    try {
      this.logger.log(`Updating problem category ${id}`);
      const category = await trx('problem_categories').where({ id, status: 'Open' }).first();
      if (!category) {
        throw new BadRequestException({
          message: 'Problem category not found or inactive',
          location: 'id',
        });
      }

      const {
        parent_id: dtoParentId,
        name_uz,
        name_ru,
        name_en,
        phone_category_id,
        price,
        estimated_minutes,
      } = dto;
      let parentId = dtoParentId ?? category.parent_id;
      if (typeof parentId === 'string' && parentId.trim() === '') parentId = null;

      if (id === parentId) {
        throw new BadRequestException({
          message: 'Category cannot be its own parent',
          location: 'parent_id',
        });
      }

      if (parentId && phone_category_id) {
        throw new BadRequestException({
          message: 'Cannot provide both parent_id and phone_category_id',
          location: 'conflict_parent_and_phone',
        });
      }

      if (!parentId && !phone_category_id) {
        throw new BadRequestException({
          message: 'phone_category_id is required for root-level problems',
          location: 'phone_category_id',
        });
      }

      if (parentId) {
        const parent = await trx('problem_categories')
          .where({ id: parentId, status: 'Open', is_active: true })
          .first();
        if (!parent) {
          throw new BadRequestException({
            message: 'Parent category not found or inactive',
            location: 'parent_id',
          });
        }
      }

      if (phone_category_id) {
        const isParent = await trx('phone_categories')
          .where({ parent_id: phone_category_id, status: 'Open' })
          .first();
        if (isParent) {
          throw new BadRequestException({
            message: 'Cannot assign problem to a phone category with children',
            location: 'phone_category_id',
          });
        }
      }

      if (name_uz || name_ru || name_en) {
        const conflictQuery = trx('problem_categories')
          .whereNot({ id })
          .andWhere((qb) => {
            if (name_uz) void qb.orWhere('name_uz', name_uz);
            if (name_ru) void qb.orWhere('name_ru', name_ru);
            if (name_en) void qb.orWhere('name_en', name_en);
          });

        if (parentId) {
          void conflictQuery.andWhere({ parent_id: parentId });
        } else if (phone_category_id) {
          void conflictQuery
            .whereNull('parent_id')
            .join(
              'phone_problem_mappings as ppm',
              'ppm.problem_category_id',
              'problem_categories.id',
            )
            .andWhere({ 'ppm.phone_category_id': phone_category_id });
        }

        const conflict = await conflictQuery.first();
        if (conflict) {
          throw new BadRequestException({
            message: 'Problem with same name already exists',
            location: 'name_conflict',
          });
        }
      }

      const updateData: Partial<ProblemCategory> = {
        name_uz,
        name_ru,
        name_en,
        parent_id: parentId,
        price: price ? String(price) : undefined,
        estimated_minutes,
        updated_at: new Date().toISOString(),
      };

      await trx('problem_categories').where({ id }).update(updateData);
      if (phone_category_id) {
        const mappingExists = await trx('phone_problem_mappings')
          .where({ phone_category_id, problem_category_id: id })
          .first();
        if (!mappingExists) {
          await trx('phone_problem_mappings').insert({
            phone_category_id,
            problem_category_id: id,
          });
        }
      }

      await trx.commit();
      await Promise.all([
        phone_category_id
          ? this.redisService.flushByPrefix(`${this.redisKeyRoot}${phone_category_id}`)
          : Promise.resolve(),
        parentId || category.parent_id
          ? this.redisService.flushByPrefix(
              `${this.redisKeyChildren}${parentId || category.parent_id}`,
            )
          : Promise.resolve(),
      ]);
      this.logger.log(`Updated problem category ${id}`);
      return { message: 'Problem category updated successfully' };
    } catch (err) {
      await trx.rollback();
      this.logger.error(`Failed to update problem category ${id}`);
      throw new BadRequestException({
        message: 'Failed to update problem category',
        location: 'update_problem_category',
      });
    }
  }

  async updateSort(id: string, newSort: number): Promise<{ message: string }> {
    const trx = await this.knex.transaction();
    try {
      this.logger.log(`Updating sort for problem category ${id} to ${newSort}`);
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

      await Promise.all([
        category.parent_id
          ? this.redisService.flushByPrefix(`${this.redisKeyChildren}${category.parent_id}`)
          : Promise.resolve(),
        !category.parent_id
          ? this.knex('phone_problem_mappings')
              .where({ problem_category_id: id })
              .first()
              .then((mappings) =>
                mappings?.phone_category_id
                  ? this.redisService.flushByPrefix(
                      `${this.redisKeyRoot}${mappings.phone_category_id}`,
                    )
                  : Promise.resolve(),
              )
          : Promise.resolve(),
      ]);
      this.logger.log(`Updated sort for problem category ${id}`);
      return { message: 'Sort updated successfully' };
    } catch (err) {
      await trx.rollback();
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

      const hasChildren = await trx('problem_categories')
        .where({ parent_id: id, status: 'Open' })
        .first();
      if (hasChildren) {
        throw new BadRequestException({
          message: 'Cannot delete category with child problems',
          location: 'has_children',
        });
      }

      await trx('problem_categories')
        .where({ id })
        .update({ status: 'Deleted', updated_at: new Date().toISOString() });
      await trx.commit();

      await Promise.all([
        category.parent_id
          ? this.redisService.flushByPrefix(`${this.redisKeyChildren}${category.parent_id}`)
          : Promise.resolve(),
        !category.parent_id
          ? this.knex('phone_problem_mappings')
              .where({ problem_category_id: id })
              .first()
              .then((mappings) =>
                mappings?.phone_category_id
                  ? this.redisService.flushByPrefix(
                      `${this.redisKeyRoot}${mappings.phone_category_id}`,
                    )
                  : Promise.resolve(),
              )
          : Promise.resolve(),
      ]);
      this.logger.log(`Deleted problem category ${id}`);
      return { message: 'Problem category deleted successfully' };
    } catch (err) {
      await trx.rollback();
      this.logger.error(`Failed to delete problem category ${id}`);
      throw new BadRequestException({
        message: 'Failed to delete problem category',
        location: 'delete_problem_category',
      });
    }
  }
}
