import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Knex } from 'knex';
import { InjectKnex } from 'nestjs-knex';
import { RedisClientType } from 'redis';
import { RedisService } from 'src/common/redis/redis.service';
import { getNextSortValue } from 'src/common/utils/sort.util';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchesService {
    constructor(
        @InjectKnex() private readonly knex: Knex,
        private readonly redisService: RedisService,
    ) { }

    private readonly redisKey = 'branches:all';
    private readonly redisKeyById = 'branches:by_id';

    private getAdminBranchesKey(adminId: string): string {
        return `admin:${adminId}:branches`;
    }

    async create(dto: CreateBranchDto, adminId: string) {
        const nextSort = await getNextSortValue(this.knex, 'branches');

        const [branch] = await this.knex('branches')
            .insert({
                ...dto,
                sort: nextSort,
                created_by: adminId,
            })
            .returning('*');

        await this.redisService.flushByPrefix(`${this.redisKey}`);
        await this.redisService.flushByPrefix(`${this.redisKeyById}`);

        const allBranches = await this.knex('branches')
            .where({ is_active: true, status: 'Open' });

        await Promise.all(
            allBranches.map((b) =>
                this.redisService.set(`${this.redisKeyById}:${b.id}`, b, 3600)
            )
        );

        return branch;
    }

    async findAll(offset = 0, limit = 10, search?: string) {
        const isSearch = Boolean(search);
        const redisKey = isSearch ? null : `${this.redisKey}:${offset}:${limit}`;

        if (redisKey) {
            const cached = await this.redisService.get(redisKey);
            if (cached) return cached;
        }

        const query = this.knex('branches')
            .where({ is_active: true, status: 'Open' });

        if (isSearch) {
            query.andWhereILike('name', `%${search}%`);
        }

        const branches = await query
            .orderBy('sort', 'asc')
            .offset(offset)
            .limit(limit);

        if (redisKey) {
            await this.redisService.set(redisKey, branches, 3600);
        }

        return branches;
    }

    async findByAdminId(adminId: string): Promise<any[]> {
        const redisKey = this.getAdminBranchesKey(adminId);

        const cached = await this.redisService.get(redisKey);
        if (cached) {
            return cached;
        }

        const branches = await this.knex('branches as b')
            .join('admin_branches as ab', 'ab.branch_id', 'b.id')
            .where('ab.admin_id', adminId)
            .andWhere('b.status', 'Open')
            .andWhere('b.is_active', true)
            .select(
                'b.id',
                'b.name_uz',
                'b.name_ru',
                'b.name_en',
                'b.bg_color',
                'b.color',
                'b.sort'
            )
            .orderBy('b.sort', 'asc');

        await this.redisService.set(redisKey, branches, 3600);

        return branches;
    }

    async findOne(id: string) {
        const branch = await this.knex('branches').where({ id }).first();
        if (!branch) throw new NotFoundException({
            message: 'Branch not found',
            location: "branch_not_found"
        });
        return branch;
    }

    async updateSort(branch: any, newSort: number) {
        const trx = await this.knex.transaction();

        try {
            const currentSort = branch.sort;

            if (newSort === currentSort) {
                return { message: 'No change needed' };
            }

            if (newSort < currentSort) {
                await trx('branches')
                    .where('sort', '>=', newSort)
                    .andWhere('sort', '<', currentSort)
                    .update({ sort: this.knex.raw('sort + 1') });
            } else {
                await trx('branches')
                    .where('sort', '<=', newSort)
                    .andWhere('sort', '>', currentSort)
                    .update({ sort: this.knex.raw('sort - 1') });
            }

            await trx('branches')
                .where({ id: branch.id })
                .update({ sort: newSort, updated_at: new Date() });

            await trx.commit();

            await this.redisService.flushByPrefix(`${this.redisKey}`);
            await this.redisService.flushByPrefix(`${this.redisKeyById}`);

            return { message: 'Sort updated successfully' };
        } catch (error) {
            await trx.rollback();
            throw error;
        }
    }

    async update(branch: any, dto: UpdateBranchDto) {
        if (dto?.is_active === false && branch?.is_protected) {
            throw new ForbiddenException({
                message: 'This branch is system-protected and cannot be deleted or deactivated.',
                location: 'branch_protected',
            });
        }

        await this.knex('branches')
            .where({ id: branch.id })
            .update({
                ...dto,
                updated_at: new Date(),
            });

        const updated = await this.knex('branches').where({ id: branch.id }).first();

        await this.redisService.set(`${this.redisKeyById}:${branch.id}`, updated, 3600);

        await this.redisService.flushByPrefix(`${this.redisKey}`);

        return {
            message: 'Branch updated successfully',
            data: updated,
        };
    }

    async delete(branch: any) {
        let branchId = branch.id

        if (branch?.is_protected) {
            throw new ForbiddenException({
                message: 'This branch is system-protected and cannot be deleted or deactivated.',
                location: 'branch_protected',
            });
        }

        await this.knex('branches')
            .where({ id: branchId })
            .update({
                is_active: false,
                status: 'Deleted',
                updated_at: new Date(),
            });

        await this.redisService.del(`${this.redisKeyById}:${branchId}`);
        await this.redisService.flushByPrefix(`${this.redisKey}`);

        return { message: 'Branch deleted successfully' };
    }


}
