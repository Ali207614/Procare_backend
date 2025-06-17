import { Injectable } from '@nestjs/common';
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

        const rows = dto.admin_ids.map((id) => ({
            repair_order_id: orderId,
            admin_id: id,
            created_at: new Date(),
        }));

        await trx('repair_order_assign_admins').insert(rows);
    }

    async insertInitialProblems(trx: Knex.Transaction, dto: CreateRepairOrderDto, adminId: string, statusId: string, orderId: string) {
        if (!dto.initial_problems?.length) return;

        await this.permissionService.validatePermissionOrThrow(adminId, statusId, 'can_change_initial_problems', 'initial_problems');

        const rows = dto.initial_problems.map((p) => ({
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

    async insertFinalProblems(trx: Knex.Transaction, dto: CreateRepairOrderDto, adminId: string, statusId: string, orderId: string) {
        if (!dto.final_problems?.length) return;

        await this.permissionService.validatePermissionOrThrow(adminId, statusId, 'can_change_final_problems', 'final_problems');

        const rows = dto.final_problems.map((p) => ({
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
