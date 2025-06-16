import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateProblemCategoryDto } from './dto/create-problem-category.dto';
import { getNextSortValue } from 'src/common/utils/sort.util';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

@Injectable()
export class ProblemCategoriesService {
    constructor(@InjectKnex() private readonly knex: Knex) { }

    async create(dto: CreateProblemCategoryDto, adminId: string) {
        const { parent_id, name_uz, name_ru, name_en } = dto;

        if (parent_id) {
            const parent = await this.knex('problem_categories')
                .where({ id: parent_id, status: 'Open' })
                .first();

            if (!parent) {
                throw new BadRequestException({
                    message: 'Parent category not found ',
                    location: 'parent_id',
                });
            }

            const existing = await this.knex('problem_categories')
                .where({ parent_id, name_uz })
                .orWhere({ parent_id, name_ru })
                .orWhere({ parent_id, name_en })
                .first();

            if (existing) {
                throw new BadRequestException({
                    message: 'Problem with same name already exists under this parent',
                    location: 'name_conflict',
                });
            }
        }

        const nextSort = await getNextSortValue(this.knex, 'problem_categories');

        const [problem] = await this.knex('problem_categories')
            .insert({
                ...dto,
                sort: nextSort,
                created_by: adminId,
            })
            .returning('*');

        return problem;
    }

    async findAll(parent_id?: string, query?: PaginationQueryDto) {
        const q = this.knex('problem_categories as pc')
            .where('pc.status', 'Open')
            .select(
                'pc.*',
                this.knex.raw(`(
              SELECT COALESCE(JSON_AGG(row_to_json(c.*)), '[]')
              FROM problem_categories c
              WHERE c.parent_id = pc.id AND c.status = 'Open'
            ) as children`)
            );

        if (parent_id) {
            q.andWhere('pc.parent_id', parent_id);
        } else {
            q.whereNull('pc.parent_id');
        }

        if (query?.search) {
            q.andWhere((builder) =>
                builder
                    .whereILike('pc.name_uz', `%${query.search}%`)
                    .orWhereILike('pc.name_ru', `%${query.search}%`)
                    .orWhereILike('pc.name_en', `%${query.search}%`)
            );
        }

        return q
            .orderBy('pc.sort', 'asc')
            .offset(query?.offset || 0)
            .limit(query?.limit || 20);
    }

    async update(id: string, dto: Partial<CreateProblemCategoryDto>) {
        const category = await this.knex('problem_categories')
            .where({ id, status: 'Open' })
            .first();

        if (!category) {
            throw new BadRequestException({
                message: 'Problem category not found or inactive',
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
            const parent = await this.knex('problem_categories')
                .where({ id: parentId, status: 'Open' })
                .first();

            if (!parent) {
                throw new BadRequestException({
                    message: 'Parent category not found or inactive',
                    location: 'parent_id',
                });
            }
        }

        await this.knex('problem_categories')
            .where({ id })
            .update({ ...dto, parent_id: parentId, updated_at: new Date() });

        return { message: 'Problem category updated successfully' };
    }

    async updateSort(id: string, newSort: number) {
        const category = await this.knex('problem_categories')
            .where({ id, status: 'Open' })
            .first();

        if (!category) {
            throw new BadRequestException({
                message: 'Problem category not found or inactive',
                location: 'id',
            });
        }

        const trx = await this.knex.transaction();
        try {
            const currentSort = category.sort;

            if (newSort === currentSort) {
                return { message: 'No change needed' };
            }

            if (newSort < currentSort) {
                await trx('problem_categories')
                    .where('sort', '>=', newSort)
                    .andWhere('sort', '<', currentSort)
                    .update({ sort: this.knex.raw('sort + 1') });
            } else {
                await trx('problem_categories')
                    .where('sort', '<=', newSort)
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

    async delete(id: string) {
        const category = await this.knex('problem_categories')
            .where({ id, status: 'Open' })
            .first();

        if (!category) {
            throw new BadRequestException({
                message: 'Problem category not found or already deleted',
                location: 'id',
            });
        }

        const hasChildren = await this.knex('problem_categories')
            .where({ parent_id: id, status: 'Open' })
            .first();

        if (hasChildren) {
            throw new BadRequestException({
                message: 'Cannot delete category with child categories',
                location: 'has_children',
            });
        }

        const isUsedInMappings = await this.knex('phone_problem_mappings')
            .where({ problem_category_id: id })
            .first();

        if (isUsedInMappings) {
            throw new BadRequestException({
                message: 'Cannot delete category that is mapped to phones',
                location: 'has_mappings',
            });
        }

        await this.knex('problem_categories')
            .where({ id })
            .update({ status: 'Deleted', updated_at: new Date() });

        return { message: 'Problem category deleted (soft)' };
    }
}