import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import { getNextSortValue } from 'src/common/utils/sort.util';
import { defaultRepairOrderStatusPermissions } from 'src/common/utils/repair-status-permissions.util';
import { CreateRepairOrderStatusDto } from './dto/create-repair-order-status.dto';
import { UpdateRepairOrderStatusDto } from './dto/update-repair-order-status.dto';
import { RedisService } from 'src/common/redis/redis.service';

@Injectable()
export class RepairOrderStatusesService {
    private readonly redisKey = 'status_viewable:';
    private readonly redisKeyAll = 'repair_order_statuses:all:';
    private readonly redisKeyById = 'repair_order_statuses:id';
    private readonly redisKeyPrefix = 'repair_order_statuses:id:';

    constructor(
        @InjectKnex() private readonly knex: Knex,
        private readonly redisService: RedisService,
    ) { }

    async create(dto: CreateRepairOrderStatusDto, adminId: string) {
        let branchId = dto.branch_id;
        let branch;

        if (branchId) {
            const redisKey = `branches:by_id:${branchId}`;
            branch = await this.redisService.get(redisKey);

            if (!branch) {
                branch = await this.knex('branches')
                    .where({ id: branchId, status: 'Open' })
                    .first();

                if (!branch) {
                    throw new BadRequestException({
                        message: 'Branch not found or deleted',
                        location: 'branch_id',
                    });
                }

                if (!branch?.is_active) {
                    throw new BadRequestException({
                        message: 'Branch inactive',
                        location: 'branch_id',
                    });
                }

                await this.redisService.set(redisKey, branch, 3600);
            }

            branchId = branch.id;
        } else {
            const defaultBranch = await this.knex('branches')
                .select('id')
                .where({ is_protected: true, is_active: true, status: 'Open' })
                .first();

            if (!defaultBranch) {
                throw new BadRequestException({
                    message: 'Default protected branch not found',
                    location: 'default_branch_missing',
                });
            }

            branchId = defaultBranch.id;
        }

        const nextSort = await getNextSortValue(this.knex, 'repair_order_statuses', {
            where: { branch_id: branchId },
        });

        const [created] = await this.knex('repair_order_statuses')
            .insert({
                ...dto,
                branch_id: branchId,
                sort: nextSort,
                created_by: adminId,
            })
            .returning('*');

        const admins = await this.knex('admin_branches')
            .select('admin_id')
            .where({ branch_id: branchId });

        const rows = admins.map(({ admin_id }) => ({
            branch_id: branchId,
            status_id: created.id,
            admin_id,
            ...defaultRepairOrderStatusPermissions,
        }));

        if (rows.length) {
            await this.knex('repair_order_status_permissions').insert(rows);
        }

        await this.redisService.flushByPrefix(`${this.redisKey}${branchId}:`);
        await this.redisService.flushByPrefix(`${this.redisKeyAll}${branchId}`);

        return created;
    }


    async findViewable(adminId: string, branchId: string) {
        const cacheKey = `${this.redisKey}${branchId}:${adminId}`;
        const cached = await this.redisService.get(cacheKey);
        if (cached !== null) return cached;

        const statusIds = await this.knex('repair_order_status_permissions')
            .select('status_id')
            .where({ admin_id: adminId, branch_id: branchId, can_view: true });

        const ids = statusIds.map((s) => s.status_id);
        if (!ids.length) {
            await this.redisService.set(cacheKey, [], 300);
            return [];
        }

        const statuses = await this.knex('repair_order_statuses')
            .whereIn('id', ids)
            .andWhere({ is_active: true, status: 'Open', branch_id: branchId })
            .orderBy('sort', 'asc');

        await this.redisService.set(cacheKey, statuses, 3600);
        return statuses;
    }

    async findAllStatuses(branchId: string) {
        const cacheKey = `${this.redisKeyAll}${branchId}`;
        const cached = await this.redisService.get(cacheKey);
        if (cached !== null) return cached;

        const statuses = await this.knex('repair_order_statuses')
            .where({ branch_id: branchId, status: 'Open' })
            .orderBy('sort', 'asc');

        await this.redisService.set(cacheKey, statuses, 3600);
        return statuses;
    }

    async updateSort(status: any, newSort: number) {
        const trx = await this.knex.transaction();
        try {
            const currentSort = status.sort;

            if (newSort === currentSort) {
                return { message: 'No change needed' };
            }

            if (newSort < currentSort) {
                await trx('repair_order_statuses')
                    .where('branch_id', status.branch_id)
                    .andWhere('sort', '>=', newSort)
                    .andWhere('sort', '<', currentSort)
                    .update({ sort: this.knex.raw('sort + 1') });
            } else {
                await trx('repair_order_statuses')
                    .where('branch_id', status.branch_id)
                    .andWhere('sort', '<=', newSort)
                    .andWhere('sort', '>', currentSort)
                    .update({ sort: this.knex.raw('sort - 1') });
            }

            await trx('repair_order_statuses')
                .where({ id: status.id })
                .update({ sort: newSort, updated_at: new Date() });

            await trx.commit();

            await this.redisService.flushByPrefix(`${this.redisKey}${status.branch_id}:`);
            await this.redisService.flushByPrefix(`${this.redisKeyAll}${status.branch_id}`);

            return { message: 'Sort updated successfully' };
        } catch (error) {
            await trx.rollback();
            throw error;
        }
    }

    async update(status: any, dto: UpdateRepairOrderStatusDto) {

        let branchId = dto.branch_id;
        let branch;

        if (branchId) {
            const redisKey = `branches:by_id:${branchId}`;
            branch = await this.redisService.get(redisKey);

            if (!branch) {
                branch = await this.knex('branches')
                    .where({ id: branchId, status: 'Open' })
                    .first();

                if (!branch) {
                    throw new BadRequestException({
                        message: 'Branch not found or deleted',
                        location: 'branch_id',
                    });
                }

                if (!branch?.is_active) {
                    throw new BadRequestException({
                        message: 'Branch inactive',
                        location: 'branch_id',
                    });
                }

                await this.redisService.set(redisKey, branch, 3600);
            }

            branchId = branch.id;
        }

        await this.knex('repair_order_statuses')
            .where({ id: status.id })
            .update({ ...dto, updated_at: new Date() });

        const updated = await this.knex('repair_order_statuses')
            .where({ id: status.id })
            .first();

        await this.redisService.set(`${this.redisKeyById}:${status.id}`, updated, 3600);
        await this.redisService.flushByPrefix(`${this.redisKey}${status.branch_id}:`);
        await this.redisService.flushByPrefix(`${this.redisKeyAll}${status.branch_id}`);

        return {
            message: 'Status updated successfully',
            data: updated,
        };
    }

    async delete(status: any) {

        await this.knex('repair_order_statuses')
            .where({ id: status.id })
            .update({ status: 'Deleted', updated_at: new Date() });

        await this.redisService.del(`${this.redisKeyById}:${status.id}`);
        await this.redisService.flushByPrefix(`${this.redisKey}${status.branch_id}:`);
        await this.redisService.flushByPrefix(`${this.redisKeyAll}${status.branch_id}`);

        return { message: 'Status deleted successfully' };
    }

    async getOrLoadStatusById(statusId: string) {
        const redisKey = `${this.redisKeyPrefix}${statusId}`;
        let status = await this.redisService.get(redisKey);

        if (!status) {
            status = await this.knex('repair_order_statuses')
                .where({ id: statusId, status: 'Open' })
                .first();

            if (!status) {
                throw new BadRequestException({
                    message: 'Repair order status not found or inactive',
                    location: 'from_status_id',
                });
            }

            await this.redisService.set(redisKey, status, 3600);
        }

        return status;
    }
}
