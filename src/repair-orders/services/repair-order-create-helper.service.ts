import { BadRequestException, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';
import { RepairOrderStatusPermissionsService } from 'src/repair-order-status-permission/repair-order-status-permissions.service';
import { CreateRepairOrderDto } from '../dto/create-repair-order.dto';

@Injectable()
export class RepairOrderCreateHelperService {
    constructor(
        private readonly permissionService: RepairOrderStatusPermissionsService,
    ) { }

    async insertAssignAdmins(trx: Knex.Transaction, dto: CreateRepairOrderDto, adminId: string, statusId: string, orderId: string) {
        if (!dto.admin_ids?.length) return;

        await this.permissionService.validatePermissionOrThrow(adminId, statusId, 'can_assign_admin', 'admin_ids');

        const uniqueIds = [...new Set(dto.admin_ids)];

        const existing = await trx('admins')
            .whereIn('id', uniqueIds)
            .pluck('id');

        const notFound = uniqueIds.filter(id => !existing.includes(id));
        if (notFound.length) {
            throw new BadRequestException({
                message: 'Admin(s) not found',
                location: 'admin_ids',
                missing_ids: notFound,
            });
        }

        const rows = uniqueIds.map((id) => ({
            repair_order_id: orderId,
            admin_id: id,
            created_at: new Date(),
        }));

        await trx('repair_order_assign_admins').insert(rows);
    }


    async insertInitialProblems(
        trx: Knex.Transaction,
        dto: CreateRepairOrderDto,
        adminId: string,
        statusId: string,
        orderId: string
    ) {
        if (!dto.initial_problems?.length) return;

        await this.permissionService.validatePermissionOrThrow(
            adminId,
            statusId,
            'can_change_initial_problems',
            'initial_problems',
        );

        const phoneCategoryId = dto.phone_category_id;
        const problemIds = dto.initial_problems.map(p => p.problem_category_id);

        const mappings = await trx('phone_problem_mappings')
            .where({ phone_category_id: phoneCategoryId })
            .whereIn('problem_category_id', problemIds)
            .pluck('problem_category_id');

        const invalidProblems = problemIds.filter(id => !mappings.includes(id));

        if (invalidProblems.length) {
            throw new BadRequestException({
                message: 'Some problems are not allowed for this phone category',
                location: 'initial_problems',
                invalid_problem_ids: invalidProblems,
            });
        }

        const rows = dto.initial_problems.map(p => ({
            repair_order_id: orderId,
            problem_category_id: p.problem_category_id,
            price: p.price,
            estimated_minutes: p.estimated_minutes,
            created_by: adminId,
            created_at: new Date(),
            updated_at: new Date(),
        }));

        await trx('repair_order_initial_problems').insert(rows);
    }


    async insertFinalProblems(
        trx: Knex.Transaction,
        dto: CreateRepairOrderDto,
        adminId: string,
        statusId: string,
        orderId: string
    ) {
        if (!dto.final_problems?.length) return;

        await this.permissionService.validatePermissionOrThrow(
            adminId,
            statusId,
            'can_change_final_problems',
            'final_problems',
        );

        const phoneCategoryId = dto.phone_category_id;
        const problemIds = dto.final_problems.map(p => p.problem_category_id);

        const mappings = await trx('phone_problem_mappings')
            .where({ phone_category_id: phoneCategoryId })
            .whereIn('problem_category_id', problemIds)
            .pluck('problem_category_id');

        const invalidProblems = problemIds.filter(id => !mappings.includes(id));

        if (invalidProblems.length) {
            throw new BadRequestException({
                message: 'Some final problems are not allowed for this phone category',
                location: 'final_problems',
                invalid_problem_ids: invalidProblems,
            });
        }

        const rows = dto.final_problems.map(p => ({
            repair_order_id: orderId,
            problem_category_id: p.problem_category_id,
            price: p.price,
            estimated_minutes: p.estimated_minutes,
            created_by: adminId,
            created_at: new Date(),
            updated_at: new Date(),
        }));

        await trx('repair_order_final_problems').insert(rows);
    }


    async insertComments(trx: Knex.Transaction, dto: CreateRepairOrderDto, adminId: string, statusId: string, orderId: string) {
        if (!dto.comments?.length) return;

        await this.permissionService.validatePermissionOrThrow(adminId, statusId, 'can_comment', 'comments');

        const rows = dto.comments.map((c) => ({
            repair_order_id: orderId,
            text: c.text,
            status: 'Open',
            created_by: adminId,
            status_by: statusId,
            created_at: new Date(),
            updated_at: new Date(),
        }));

        await trx('repair_order_comments').insert(rows);
    }

    async insertPickup(trx: Knex.Transaction, dto: CreateRepairOrderDto, adminId: string, statusId: string, orderId: string) {
        if (!dto.pickup) return;

        await this.permissionService.validatePermissionOrThrow(adminId, statusId, 'can_pickup_manage', 'pickup');

        await trx('repair_order_pickups').insert({
            repair_order_id: orderId,
            ...dto.pickup,
            created_by: adminId,
            created_at: new Date(),
            updated_at: new Date(),
        });
    }

    async insertDelivery(trx: Knex.Transaction, dto: CreateRepairOrderDto, adminId: string, statusId: string, orderId: string) {
        if (!dto.delivery) return;

        await this.permissionService.validatePermissionOrThrow(adminId, statusId, 'can_delivery_manage', 'delivery');

        await trx('repair_order_deliveries').insert({
            repair_order_id: orderId,
            ...dto.delivery,
            created_by: adminId,
            created_at: new Date(),
            updated_at: new Date(),
        });
    }
}
