import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import { AssignRepairOrderStatusPermissionsDto } from './dto/create-repair-order-status-permission.dto';
import { RedisService } from 'src/common/redis/redis.service';

@Injectable()
export class RepairOrderStatusPermissionsService {
    constructor(
        @InjectKnex() private readonly knex: Knex,
        private readonly redisService: RedisService,
    ) { }

    private readonly redisKeyByAdminStatus = 'repair_order_status_permissions:by_admin_status';
    private readonly redisKeyByAdminBranch = 'repair_order_status_permissions:by_admin_branch';

    async createMany(dto: AssignRepairOrderStatusPermissionsDto) {
        const { branch_id, status_id, admin_ids, ...permissions } = dto;

        const trx = await this.knex.transaction();

        try {
            await trx('repair_order_status_permissions')
                .where({ branch_id, status_id })
                .whereIn('admin_id', admin_ids)
                .del();

            const inserts = admin_ids.map((admin_id) => ({
                admin_id,
                branch_id,
                status_id,
                ...permissions,
            }));

            const inserted = await trx('repair_order_status_permissions')
                .insert(inserts)
                .returning('*');

            await trx.commit();

            await Promise.all(inserted.map((row) => this.flushAndReloadCache(row)));

            return {
                message: 'Permissions assigned successfully to selected admins',
                count: inserted.length,
            };
        } catch (error) {
            await trx.rollback();
            throw error;
        }
    }

    async findByStatusId(statusId: string) {
        const permissions = await this.knex('repair_order_status_permissions')
            .where({ status_id: statusId })
            .orderBy('created_at', 'desc');

        return permissions;
    }

    async findByAdminStatus(adminId: string, statusId: string) {
        const key = `${this.redisKeyByAdminStatus}:${adminId}:${statusId}`;
        const cached = await this.redisService.get(key);

        if (cached !== null) return cached;

        const permission = await this.knex('repair_order_status_permissions')
            .where({ admin_id: adminId, status_id: statusId })
            .first();

        await this.redisService.set(key, permission, 3600);
        return permission;
    }

    async findByAdminBranch(adminId: string, branchId: string) {
        const key = `${this.redisKeyByAdminBranch}:${adminId}:${branchId}`;
        const cached = await this.redisService.get(key);

        if (cached !== null) return cached;

        const permissions = await this.knex('repair_order_status_permissions')
            .where({ admin_id: adminId, branch_id: branchId });

        await this.redisService.set(key, permissions, 3600);
        return permissions;
    }

    private async flushAndReloadCache(permission: any) {
        const { admin_id, status_id, branch_id } = permission;

        const keyByStatus = `${this.redisKeyByAdminStatus}:${admin_id}:${status_id}`;
        const keyByBranch = `${this.redisKeyByAdminBranch}:${admin_id}:${branch_id}`;

        await Promise.all([
            this.redisService.del(keyByStatus),
            this.redisService.del(keyByBranch),
        ]);

        const [statusPermission, branchPermissions] = await Promise.all([
            this.knex('repair_order_status_permissions')
                .where({ admin_id, status_id })
                .first(),
            this.knex('repair_order_status_permissions')
                .where({ admin_id, branch_id }),
        ]);

        await Promise.all([
            this.redisService.set(keyByStatus, statusPermission, 3600),
            this.redisService.set(keyByBranch, branchPermissions, 3600),
        ]);
    }

    async validatePermissionOrThrow(adminId: string, statusId: string, permissionField: any, location: string) {
        const permission = await this.findByAdminStatus(adminId, statusId);

        if (!permission?.[permissionField]) {
            throw new ForbiddenException({
                message: `You do not have permission: ${permissionField}`,
                location,
            });
        }
    }
}
