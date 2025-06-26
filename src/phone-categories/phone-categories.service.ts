import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreatePhoneCategoryDto } from './dto/create-phone-category.dto';
import { getNextSortValue } from 'src/common/utils/sort.util';
import { UpdatePhoneCategoryDto } from './dto/update-phone-category.dto';
import { PhoneOsTypesService } from 'src/phone-os-types/phone-os-types.service';
import { FindAllPhoneCategoriesDto } from './dto/find-all-phone-categories.dto';

@Injectable()
export class PhoneCategoriesService {
  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly phoneOsTypesService: PhoneOsTypesService,
  ) {}

  async create(dto: CreatePhoneCategoryDto, adminId: string) {
    const { parent_id, name_uz, name_ru, name_en, phone_os_type_id } = dto;

    if (phone_os_type_id) {
      const allOsTypes = await this.phoneOsTypesService.findAll();
      const found = allOsTypes.find((os) => os.id === phone_os_type_id);

      if (!found) {
        throw new BadRequestException({
          message: 'Phone OS type not found or inactive',
          location: 'phone_os_type_id',
        });
      }
    }

    const existing = await this.knex('phone_categories')
      .whereRaw('LOWER(name_uz) = LOWER(?)', [name_uz])
      .orWhereRaw('LOWER(name_ru) = LOWER(?)', [name_ru])
      .orWhereRaw('LOWER(name_en) = LOWER(?)', [name_en])
      .andWhere('parent_id', parent_id ?? null)
      .first();

    if (existing) {
      throw new BadRequestException({
        message: 'Exact same category already exists under this parent',
        location: 'name_conflict',
      });
    }

    if (parent_id) {
      const parent = await this.knex('phone_categories')
        .where({ id: parent_id, is_active: true, status: 'Open' })
        .first();

      if (!parent) {
        throw new BadRequestException({
          message: 'Parent category not found or inactive',
          location: 'parent_id',
        });
      }

      const isParentBoundToProblems = await this.knex('phone_problem_mappings')
        .where({ phone_category_id: parent_id })
        .first();

      if (isParentBoundToProblems) {
        throw new BadRequestException({
          message: 'Cannot add child to a phone category already linked with problems',
          location: 'parent_id',
        });
      }
    }

    const nextSort = await getNextSortValue(this.knex, 'phone_categories');

    const [category] = await this.knex('phone_categories')
      .insert({
        ...dto,
        sort: nextSort,
        created_by: adminId,
      })
      .returning('*');

    return category;
  }

  async findOne(id: string) {
    const category = await this.knex('phone_categories as pc')
      .where('pc.id', id)
      .andWhere('pc.is_active', true)
      .andWhere('pc.status', 'Open')
      .select(
        'pc.*',
        this.knex.raw(`(
        SELECT COALESCE(JSON_AGG(row_to_json(c.*) ORDER BY c.sort), '[]')
        FROM phone_categories c
        WHERE c.parent_id = pc.id AND c.is_active = true AND c.status = 'Open'
      ) as children`),
        this.knex.raw(`(
        SELECT COALESCE(JSON_AGG(row_to_json(p.*) ORDER BY p.sort), '[]')
        FROM phone_problem_mappings ppm
        JOIN problem_categories p ON p.id = ppm.problem_category_id
        WHERE ppm.phone_category_id = pc.id
      ) as problems`),
      )
      .first();

    if (!category) {
      throw new NotFoundException({
        message: 'Phone category not found or inactive',
        location: 'id',
      });
    }

    return category;
  }

  async findAll(query: FindAllPhoneCategoriesDto) {
    const { phone_os_type_id, parent_id, limit, offset, search } = query;

    const q = this.knex('phone_categories as pc')
      .where('pc.is_active', true)
      .andWhere('pc.status', 'Open')
      .select(
        'pc.*',
        this.knex.raw(`(
              SELECT COALESCE(JSON_AGG(row_to_json(c.*) ORDER BY c.sort), '[]')
              FROM phone_categories c
              WHERE c.parent_id = pc.id AND c.is_active = true AND c.status = 'Open'
            ) as children`),
        this.knex.raw(`(
              SELECT COALESCE(JSON_AGG(row_to_json(p.*) ORDER BY p.sort), '[]')
              FROM phone_problem_mappings ppm
              JOIN problem_categories p ON p.id = ppm.problem_category_id
              WHERE ppm.phone_category_id = pc.id 
            ) as problems`),
      );

    if (phone_os_type_id) {
      q.andWhere('pc.phone_os_type_id', phone_os_type_id);
    }

    if (parent_id) {
      q.andWhere('pc.parent_id', parent_id);
    } else {
      q.whereNull('pc.parent_id');
    }

    if (search) {
      q.andWhere((builder) =>
        builder
          .whereILike('pc.name_uz', `%${search}%`)
          .orWhereILike('pc.name_ru', `%${search}%`)
          .orWhereILike('pc.name_en', `%${search}%`),
      );
    }

    return q
      .orderBy('pc.sort', 'asc')
      .offset(offset || 0)
      .limit(limit || 20);
  }

  async update(id: string, dto: UpdatePhoneCategoryDto) {
    const category = await this.knex('phone_categories').where({ id, status: 'Open' }).first();

    if (!category) {
      throw new BadRequestException({
        message: 'Phone category not found',
        location: 'id',
      });
    }

    let parentId = dto?.parent_id;
    if (typeof parentId === 'string' && parentId.trim() === '') {
      parentId = null;
    }

    if (id === parentId) {
      throw new BadRequestException({
        message: 'Category cannot be its own parent',
        location: 'parent_id',
      });
    }

    if (parentId) {
      const parent = await this.knex('phone_categories')
        .where({ id: parentId, is_active: true, status: 'Open' })
        .first();
      if (!parent) {
        throw new BadRequestException({
          message: 'Parent category not found or inactive',
          location: 'parent_id',
        });
      }

      const isParentBoundToProblems = await this.knex('phone_problem_mappings')
        .where({ phone_category_id: parentId })
        .first();

      if (isParentBoundToProblems) {
        throw new BadRequestException({
          message: 'Cannot add child to a phone category already linked with problems',
          location: 'parent_id',
        });
      }
    }

    if (dto?.phone_os_type_id) {
      const allOsTypes = await this.phoneOsTypesService.findAll();
      const found = allOsTypes.find((os) => os.id === dto.phone_os_type_id);

      if (!found) {
        throw new BadRequestException({
          message: 'Phone OS type not found or inactive',
          location: 'phone_os_type_id',
        });
      }
    }

    await this.knex('phone_categories')
      .where({ id })
      .update({ ...dto, parent_id: parentId, updated_at: new Date() });

    return { message: 'Phone category updated successfully' };
  }

  async updateSort(id: string, newSort: number) {
    const category = await this.knex('phone_categories').where({ id, status: 'Open' }).first();

    if (!category) {
      throw new BadRequestException({
        message: 'Phone category not found or inactive',
        location: 'id',
      });
    }
    const { parent_id } = category;

    const trx = await this.knex.transaction();
    try {
      const currentSort = category.sort;

      if (newSort === currentSort) {
        return { message: 'Sort updated successfully' };
      }

      if (newSort < currentSort) {
        await trx('phone_categories')
          .where({ parent_id: parent_id ?? null })
          .andWhere('sort', '>=', newSort)
          .andWhere('sort', '<', currentSort)
          .update({ sort: this.knex.raw('sort + 1') });
      } else {
        await trx('phone_categories')
          .where({ parent_id: parent_id ?? null })
          .andWhere('sort', '<=', newSort)
          .andWhere('sort', '>', currentSort)
          .update({ sort: this.knex.raw('sort - 1') });
      }

      await trx('phone_categories')
        .where({ id: category.id })
        .update({ sort: newSort, updated_at: new Date() });

      await trx.commit();

      return { message: 'Sort updated successfully' };
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  async delete(id: string) {
    const category = await this.knex('phone_categories').where({ id, status: 'Open' }).first();

    if (!category) {
      throw new BadRequestException({
        message: 'Phone category not found or already deleted',
        location: 'id',
      });
    }

    const hasChildren = await this.knex('phone_categories')
      .where({ parent_id: id, status: 'Open' })
      .first();

    if (hasChildren) {
      throw new BadRequestException({
        message: 'Cannot delete category with child categories',
        location: 'has_children',
      });
    }

    const hasProblems = await this.knex('phone_problem_mappings')
      .where({ phone_category_id: id })
      .first();

    if (hasProblems) {
      throw new BadRequestException({
        message: 'Cannot delete category with linked problems',
        location: 'has_problems',
      });
    }

    await this.knex('phone_categories')
      .where({ id })
      .update({ status: 'Deleted', updated_at: new Date() });

    return { message: 'Phone category deleted (soft)' };
  }
}
