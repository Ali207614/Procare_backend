import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import { BadRequestException, Injectable } from '@nestjs/common';
import { CreatePhoneCategoryDto } from './dto/create-phone-category.dto';
import { getNextSortValue } from 'src/common/utils/sort.util';
import { UpdatePhoneCategoryDto } from './dto/update-phone-category.dto';
import { PhoneOsTypesService } from 'src/phone-os-types/phone-os-types.service';
import { FindAllPhoneCategoriesDto } from './dto/find-all-phone-categories.dto';
import { PhoneOsType } from 'src/common/types/phone-os-type.interface';
import { PhoneCategory, PhoneCategoryWithMeta } from 'src/common/types/phone-category.interface';

@Injectable()
export class PhoneCategoriesService {
  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly phoneOsTypesService: PhoneOsTypesService,
  ) {}

  async create(dto: CreatePhoneCategoryDto, adminId: string): Promise<PhoneCategory> {
    const { parent_id, name_uz, name_ru, name_en, phone_os_type_id } = dto;

    const trx = await this.knex.transaction();
    try {
      if (phone_os_type_id) {
        const allOsTypes: PhoneOsType[] = await this.phoneOsTypesService.findAll();
        const found: PhoneOsType | undefined = allOsTypes.find(
          (os: PhoneOsType): boolean => os.id === phone_os_type_id,
        );

        if (!found || !found.is_active) {
          throw new BadRequestException({
            message: 'Phone OS type not found or inactive',
            location: 'phone_os_type_id',
          });
        }
      }

      const existing: PhoneCategory | undefined = await trx('phone_categories')
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
        const parent: PhoneCategory | undefined = await trx('phone_categories')
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

      const insertData = {
        ...dto,
        sort: nextSort,
        created_by: adminId,
        created_at: new Date(),
        is_active: true,
        status: 'Open',
      };

      const inserted: PhoneCategory[] = await trx('phone_categories')
        .insert(insertData)
        .returning('*');

      await trx.commit();
      return inserted[0];
    } catch (error) {
      await trx.rollback();
      throw error instanceof BadRequestException
        ? error
        : new BadRequestException({
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

    const trx = await this.knex.transaction();
    try {
      const q = trx('phone_categories as pc')
        .where(function () {
          if (parent_id) {
            void this.where('pc.parent_id', parent_id);
          } else {
            void this.whereNull('pc.parent_id');
          }
        })
        .andWhere('pc.is_active', true)
        .andWhere('pc.status', 'Open')
        .select(
          'pc.*',
          trx.raw(`EXISTS (
            SELECT 1 FROM phone_categories c
            WHERE c.parent_id = pc.id AND c.is_active = true AND c.status = 'Open'
          ) as has_children`),
          trx.raw(`EXISTS (
            SELECT 1 FROM phone_problem_mappings ppm
            JOIN problem_categories p ON p.id = ppm.problem_category_id
            WHERE ppm.phone_category_id = pc.id
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

      if (phone_os_type_id) {
        void q.andWhere('pc.phone_os_type_id', phone_os_type_id);
      }

      if (search) {
        void q.andWhere(
          (builder) =>
            void builder
              .whereILike('pc.name_uz', `%${search}%`)
              .orWhereILike('pc.name_ru', `%${search}%`)
              .orWhereILike('pc.name_en', `%${search}%`),
        );
      }

      const result: PhoneCategoryWithMeta[] = await q
        .orderBy('pc.sort', 'asc')
        .offset(offset)
        .limit(limit)
        .forShare();

      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      throw new BadRequestException({
        message: 'Failed to fetch phone categories',
        location: 'find_phone_categories',
      });
    }
  }

  async update(id: string, dto: UpdatePhoneCategoryDto): Promise<{ message: string }> {
    const trx = await this.knex.transaction();
    try {
      const category: PhoneCategory | undefined = await trx('phone_categories')
        .where({ id, status: 'Open' })
        .forUpdate()
        .first();

      if (!category) {
        throw new BadRequestException({
          message: 'Phone category not found or inactive',
          location: 'id',
        });
      }

      let parentId: string | undefined | null = dto?.parent_id;
      if (typeof parentId === 'string' && parentId.trim() === '') {
        parentId = null;
      }

      if (id === parentId) {
        throw new BadRequestException({
          message: 'Category cannot be its own parent',
          location: 'parent_id',
        });
      }

      if (dto.name_uz || dto.name_ru || dto.name_en) {
        const existing: PhoneCategory | undefined = await trx('phone_categories')
          .whereRaw('LOWER(name_uz) = LOWER(?)', [dto.name_uz ?? category.name_uz])
          .orWhereRaw('LOWER(name_ru) = LOWER(?)', [dto.name_ru ?? category.name_ru])
          .orWhereRaw('LOWER(name_en) = LOWER(?)', [dto.name_en ?? category.name_en])
          .andWhere('parent_id', parentId ?? category.parent_id ?? null)
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
        const parent: PhoneCategory | undefined = await trx('phone_categories')
          .where({ id: parentId, is_active: true, status: 'Open' })
          .forUpdate()
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

      if (dto?.phone_os_type_id) {
        const allOsTypes: PhoneOsType[] = await this.phoneOsTypesService.findAll();
        const found: PhoneOsType | undefined = allOsTypes.find(
          (os: PhoneOsType): boolean => os.id === dto.phone_os_type_id,
        );

        if (!found || !found.is_active) {
          throw new BadRequestException({
            message: 'Phone OS type not found or inactive',
            location: 'phone_os_type_id',
          });
        }
      }

      await trx('phone_categories')
        .where({ id })
        .update({ ...dto, parent_id: parentId, updated_at: new Date() });

      await trx.commit();
      return { message: 'Phone category updated successfully' };
    } catch (error) {
      await trx.rollback();
      throw error instanceof BadRequestException
        ? error
        : new BadRequestException({
            message: 'Failed to update phone category',
            location: 'update_phone_category',
          });
    }
  }

  async updateSort(id: string, newSort: number): Promise<{ message: string }> {
    const trx = await this.knex.transaction();
    try {
      const category: PhoneCategory | undefined = await trx('phone_categories')
        .where({ id, status: 'Open' })
        .forUpdate()
        .first();

      if (!category) {
        throw new BadRequestException({
          message: 'Phone category not found or inactive',
          location: 'id',
        });
      }
      const { parent_id, sort: currentSort } = category;

      if (newSort === currentSort) {
        await trx.commit();
        return { message: 'Sort updated successfully' };
      }

      if (newSort < currentSort) {
        await trx('phone_categories')
          .where({ parent_id: parent_id ?? null })
          .andWhere('sort', '>=', newSort)
          .andWhere('sort', '<', currentSort)
          .forUpdate()
          .update({ sort: trx.raw('sort + 1') });
      } else {
        await trx('phone_categories')
          .where({ parent_id: parent_id ?? null })
          .andWhere('sort', '<=', newSort)
          .andWhere('sort', '>', currentSort)
          .forUpdate()
          .update({ sort: trx.raw('sort - 1') });
      }

      await trx('phone_categories').where({ id }).update({ sort: newSort, updated_at: new Date() });

      await trx.commit();
      return { message: 'Sort updated successfully' };
    } catch (error) {
      await trx.rollback();
      throw error instanceof BadRequestException
        ? error
        : new BadRequestException({
            message: 'Failed to update sort',
            location: 'update_sort',
          });
    }
  }

  async delete(id: string): Promise<{ message: string }> {
    const trx = await this.knex.transaction();
    try {
      const category: PhoneCategory | undefined = await trx('phone_categories')
        .where({ id, status: 'Open' })
        .forUpdate()
        .first();

      if (!category) {
        throw new BadRequestException({
          message: 'Phone category not found or already deleted',
          location: 'id',
        });
      }

      const hasChildren: PhoneCategory | undefined = await trx('phone_categories')
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
      return { message: 'Phone category deleted (soft)' };
    } catch (error) {
      await trx.rollback();
      throw error instanceof BadRequestException
        ? error
        : new BadRequestException({
            message: 'Failed to delete phone category',
            location: 'delete_phone_category',
          });
    }
  }
}
