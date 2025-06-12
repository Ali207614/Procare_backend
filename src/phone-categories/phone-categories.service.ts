import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import { BadRequestException, Injectable } from '@nestjs/common';
import { CreatePhoneCategoryDto } from './dto/create-phone-category.dto';
import { getNextSortValue } from 'src/common/utils/sort.util';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { UpdatePhoneCategoryDto } from './dto/update-phone-category.dto';

@Injectable()
export class PhoneCategoriesService {
    constructor(@InjectKnex() private readonly knex: Knex) { }

    async create(dto: CreatePhoneCategoryDto, adminId: string) {
        const { parent_id, name_uz, name_ru, name_en, phone_os_type_id } = dto;


        const osExists = await this.knex('phone_os_types')
            .where({ id: phone_os_type_id, is_active: true, status: 'Open' })
            .first();
        if (!osExists) {
            throw new BadRequestException({
                message: 'Phone OS type not found or inactive',
                location: 'phone_os_type_id',
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

            const existing = await this.knex('phone_categories')
                .where({ parent_id, name_uz })
                .orWhere({ parent_id, name_ru })
                .orWhere({ parent_id, name_en })
                .first();

            if (existing) {
                throw new BadRequestException({
                    message: 'Category with same name already exists under this parent',
                    location: 'name_conflict',
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

    async findAll(phone_os_type_id?: string, parent_id?: string, query?: PaginationQueryDto) {
        const q = this.knex('phone_categories')
            .where({ is_active: true, status: 'Open' });

        if (phone_os_type_id) {
            q.andWhere({ phone_os_type_id });
        }

        if (parent_id) {
            q.andWhere({ parent_id });
        } else {
            q.whereNull('parent_id');
        }

        if (query?.search) {
            q.andWhere((builder) =>
                builder
                    .whereILike('name_uz', `%${query.search}%`)
                    .orWhereILike('name_ru', `%${query.search}%`)
                    .orWhereILike('name_en', `%${query.search}%`)
            );
        }

        return q
            .orderBy('sort', 'asc')
            .offset(query?.offset || 0)
            .limit(query?.limit || 20);
    }

    async update(id: string, dto: UpdatePhoneCategoryDto) {
        const category = await this.knex('phone_categories')
            .where({ id, is_active: true, status: 'Open' })
            .first();

        if (!category) {
            throw new BadRequestException({
                message: 'Phone category not found or inactive',
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
        }

        if (dto?.phone_os_type_id) {
            const osExists = await this.knex('phone_os_types')
                .where({ id: dto.phone_os_type_id, is_active: true, status: 'Open' })
                .first();
            if (!osExists) {
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
        const category = await this.knex('phone_categories')
            .where({ id, is_active: true, status: 'Open' })
            .first();

        if (!category) {
            throw new BadRequestException({
                message: 'Phone category not found or inactive',
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
                await trx('phone_categories')
                    .where('sort', '>=', newSort)
                    .andWhere('sort', '<', currentSort)
                    .update({ sort: this.knex.raw('sort + 1') });
            } else {
                await trx('phone_categories')
                    .where('sort', '<=', newSort)
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
        const category = await this.knex('phone_categories')
            .where({ id, is_active: true, status: 'Open' })
            .first();

        if (!category) {
            throw new BadRequestException({
                message: 'Phone category not found or already deleted',
                location: 'id',
            });
        }

        await this.knex('phone_categories')
            .where({ id })
            .update({ status: 'Deleted', updated_at: new Date() });

        return { message: 'Phone category deleted (soft)' };
    }

}
