import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateProblemCategoryDto } from './dto/create-problem-category.dto';
import { getNextSortValue } from 'src/common/utils/sort.util';
import { UpdateProblemCategoryDto } from './dto/update-problem-category.dto';
import { PhoneCategory } from 'src/common/types/phone-category.interface';
import {
  ProblemCategory,
  ProblemCategoryWithMeta,
} from 'src/common/types/problem-category.interface';

@Injectable()
export class ProblemCategoriesService {
  constructor(@InjectKnex() private readonly knex: Knex) {}

  async create(dto: CreateProblemCategoryDto, adminId: string): Promise<ProblemCategory> {
    const {
      parent_id,
      name_uz,
      name_ru,
      name_en,
      phone_category_id,
      price,
      estimated_minutes,
      ...rest
    } = dto;

    if (parent_id && phone_category_id) {
      throw new BadRequestException({
        message: 'Cannot provide both parent_id and phone_category_id. Only one is allowed.',
        location: 'conflict_parent_and_phone',
      });
    }

    if (parent_id) {
      const parent: ProblemCategory | undefined = await this.knex('problem_categories')
        .where({ id: parent_id, status: 'Open', is_active: true })
        .first();

      if (!parent) {
        throw new BadRequestException({
          message: 'Parent problem category not found',
          location: 'parent_id',
        });
      }

      const existing: ProblemCategory | undefined = await this.knex('problem_categories')
        .where({ parent_id })
        .andWhere(
          (qb: Knex.QueryBuilder): void =>
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

    if (!parent_id && !phone_category_id) {
      throw new BadRequestException({
        message: 'phone_category_id is required for root-level problems',
        location: 'phone_category_id',
      });
    }

    if (!parent_id && phone_category_id) {
      const isParent: PhoneCategory | undefined = await this.knex<PhoneCategory>('phone_categories')
        .where({ parent_id: phone_category_id, status: 'Open' })
        .first();

      if (isParent) {
        throw new BadRequestException({
          message:
            'Cannot assign problem to a phone category that has children. It must be a leaf category.',
          location: 'phone_category_id',
        });
      }

      const existing: ProblemCategory | undefined = await this.knex('problem_categories as p')
        .join('phone_problem_mappings as ppm', 'ppm.problem_category_id', 'p.id')
        .where({
          'p.parent_id': null,
          'ppm.phone_category_id': phone_category_id,
          'p.is_active': true,
          'p.status': 'Open',
        })
        .andWhere(
          (qb: Knex.QueryBuilder): void =>
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

    const nextSort = await getNextSortValue(this.knex, 'problem_categories');

    const insertData = {
      ...rest,
      name_uz,
      name_ru,
      name_en,
      parent_id: parent_id ?? null,
      price: String(price ?? 0),
      estimated_minutes: estimated_minutes ?? 0,
      sort: nextSort,
      created_by: adminId,
    };

    const inserted: ProblemCategory[] = await this.knex<ProblemCategory>('problem_categories')
      .insert(insertData)
      .returning('*');

    const problem: ProblemCategory = inserted[0];
    if (!parent_id && phone_category_id) {
      const existingMapping = await this.knex('phone_problem_mappings')
        .where({
          phone_category_id,
          problem_category_id: problem.id,
        })
        .first();

      if (!existingMapping) {
        await this.knex('phone_problem_mappings').insert({
          phone_category_id,
          problem_category_id: problem.id,
        });
      }
    }

    return problem;
  }

  async findRootProblems(phone_category_id: string): Promise<ProblemCategoryWithMeta[]> {
    return this.knex('problem_categories as p')
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
      .orderBy('p.sort', 'asc') as Promise<ProblemCategoryWithMeta[]>;
  }

  async findChildrenWithBreadcrumb(parent_id: string): Promise<ProblemCategoryWithMeta[]> {
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
      .orderBy('p.sort', 'asc');

    if (!problems.length) {
      throw new NotFoundException({
        message: 'Problem category not found or has no children',
        location: 'parent_id',
      });
    }

    return problems;
  }

  async update(id: string, dto: UpdateProblemCategoryDto): Promise<{ message: string }> {
    const category: ProblemCategory | undefined = await this.knex('problem_categories')
      .where({ id, status: 'Open' })
      .first();

    if (!category) {
      throw new BadRequestException({
        message: 'Problem category not found or inactive',
        location: 'id',
      });
    }

    const { parent_id: dtoParentId, name_uz, name_ru, name_en, phone_category_id, ...rest } = dto;

    let parentId = dtoParentId ?? category.parent_id;
    if (typeof parentId === 'string' && parentId.trim() === '') {
      parentId = null;
    }

    if (id === parentId) {
      throw new BadRequestException({
        message: 'Category cannot be its own parent',
        location: 'parent_id',
      });
    }

    if (parentId && phone_category_id) {
      throw new BadRequestException({
        message: 'Cannot provide both parent_id and phone_category_id. Only one is allowed.',
        location: 'conflict_parent_and_phone',
      });
    }

    if (parentId) {
      const parent: ProblemCategory | undefined = await this.knex('problem_categories')
        .where({ id: parentId, status: 'Open', is_active: true })
        .first();

      if (!parent) {
        throw new BadRequestException({
          message: 'Parent category not found or inactive',
          location: 'parent_id',
        });
      }
    }

    if (!parentId) {
      if (!phone_category_id) {
        throw new BadRequestException({
          message: 'phone_category_id is required for root-level problems',
          location: 'phone_category_id',
        });
      }

      const isParent: PhoneCategory | undefined = await this.knex('phone_categories')
        .where({ parent_id: phone_category_id, is_active: true })
        .first();

      if (isParent) {
        throw new BadRequestException({
          message: 'Cannot assign problem to a phone category that has children. Must be a leaf.',
          location: 'phone_category_id',
        });
      }
    }

    if (name_uz || name_ru || name_en) {
      const conflictQuery = this.knex('problem_categories')
        .whereNot({ id })
        .andWhere((qb) => {
          if (name_uz) void qb.orWhere('name_uz', name_uz);
          if (name_ru) void qb.orWhere('name_ru', name_ru);
          if (name_en) void qb.orWhere('name_en', name_en);
        });

      if (parentId) {
        void conflictQuery.andWhere({ parent_id: parentId });
      } else {
        void conflictQuery
          .whereNull('parent_id')
          .join('phone_problem_mappings as ppm', 'ppm.problem_category_id', 'problem_categories.id')
          .andWhere({ 'ppm.phone_category_id': phone_category_id });
      }

      const conflict = await conflictQuery.first();

      if (conflict) {
        throw new BadRequestException({
          message: 'Problem with same name already exists in this context',
          location: 'name_conflict',
        });
      }
    }

    const insertData = {
      ...rest,
      ...(name_uz && { name_uz }),
      ...(name_ru && { name_ru }),
      ...(name_en && { name_en }),
      parent_id: parentId,
      updated_at: new Date(),
    };

    await this.knex('problem_categories').where({ id }).update(insertData, '*');

    if (!parentId && phone_category_id) {
      const mappingExists = await this.knex('phone_problem_mappings')
        .where({
          phone_category_id,
          problem_category_id: id,
        })
        .first();

      if (!mappingExists) {
        await this.knex('phone_problem_mappings').insert({
          phone_category_id,
          problem_category_id: id,
        });
      }
    }

    return { message: 'Problem category updated successfully' };
  }

  async updateSort(id: string, newSort: number): Promise<{ message: string }> {
    const category: ProblemCategory | undefined = await this.knex('problem_categories')
      .where({ id, status: 'Open' })
      .first();

    if (!category) {
      throw new BadRequestException({
        message: 'Problem category not found or inactive',
        location: 'id',
      });
    }
    const { parent_id } = category;

    const trx = await this.knex.transaction();
    try {
      const currentSort = category.sort;

      if (newSort === currentSort) {
        return { message: 'No change needed' };
      }

      if (newSort < currentSort) {
        await trx('problem_categories')
          .where({ parent_id: parent_id ?? null })
          .andWhere('sort', '>=', newSort)
          .andWhere('sort', '<', currentSort)
          .update({ sort: this.knex.raw('sort + 1') });
      } else {
        await trx('problem_categories')
          .where({ parent_id: parent_id ?? null })
          .andWhere('sort', '<=', newSort)
          .andWhere('sort', '>', currentSort)
          .update({ sort: this.knex.raw('sort - 1') });
      }

      await trx('problem_categories')
        .where({ id: category.id })
        .update({ sort: newSort, updated_at: new Date() });

      await trx.commit();

      return { message: 'Sort updated successfully' };
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  async delete(id: string): Promise<{ message: string }> {
    const category: ProblemCategory | undefined = await this.knex('problem_categories')
      .where({ id, status: 'Open' })
      .first();

    if (!category) {
      throw new NotFoundException({
        message: 'Problem category not found or already deleted',
        location: 'id',
      });
    }

    const hasChildren = await this.knex('problem_categories')
      .where({ parent_id: id, status: 'Open' })
      .first();

    if (hasChildren) {
      throw new BadRequestException({
        message: 'Cannot delete category with child problems',
        location: 'has_children',
      });
    }

    await this.knex('problem_categories').where({ id }).update({
      status: 'Deleted',
      updated_at: new Date(),
    });

    return {
      message: 'Problem category deleted successfully',
    };
  }
}
