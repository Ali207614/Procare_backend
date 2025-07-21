import { InjectQueue } from '@nestjs/bull';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import type { Knex } from 'knex';
import { NotificationService } from 'src/notification/notification.service';
import { RepairOrderStatusPermissionsService } from 'src/repair-order-status-permission/repair-order-status-permissions.service';
import { CreateRepairOrderDto } from '../dto/create-repair-order.dto';
import { validateAndInsertProblems } from 'src/common/utils/problem.util';
import { RepairOrderStatusPermission } from 'src/common/types/repair-order-status-permssion.interface';
import { AdminPayload } from 'src/common/types/admin-payload.interface';

@Injectable()
export class RepairOrderCreateHelperService {
  constructor(
    private readonly permissionService: RepairOrderStatusPermissionsService,
    private readonly notificationService: NotificationService,
    @InjectQueue('sap') private readonly sapQueue: Queue,
  ) {}

  async insertRentalPhone(
    trx: Knex.Transaction,
    dto: CreateRepairOrderDto,
    admin: AdminPayload,
    statusId: string,
    orderId: string,
    branchId: string,
    allPermissions: RepairOrderStatusPermission[],
  ): Promise<void> {
    if (!dto.rental_phone) return;

    await this.permissionService.checkPermissionsOrThrow(
      admin.roles,
      branchId,
      statusId,
      ['can_manage_rental_phone'],
      'repair_order_rental_phones',
      allPermissions,
    );

    const phone = dto.rental_phone;

    const device = await trx('rental_phone_devices')
      .where({ id: phone.rental_phone_device_id, is_available: true })
      .first();

    if (!device) {
      throw new BadRequestException({
        message: 'Rental phone device not found or unavailable',
        location: 'rental_phone.rental_phone_device_id',
      });
    }

    const [inserted] = await trx('repair_order_rental_phones')
      .insert({
        repair_order_id: orderId,
        rental_phone_device_id: phone.rental_phone_device_id,
        is_free: phone.is_free ?? null,
        price: phone.price ?? null,
        currency: phone.currency ?? 'UZS',
        status: 'Active',
        rented_at: new Date(),
        returned_at: null,
        notes: phone.notes ?? null,
        created_by: admin.id,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    await trx('rental_phone_devices')
      .where({ id: phone.rental_phone_device_id })
      .update({ is_available: false, updated_at: new Date() });

    const user = await trx('users').where({ id: dto.user_id }).first();

    if (!user?.sap_card_code) {
      throw new BadRequestException({
        message: 'User has no SAP card code. Cannot create rental order.',
        location: 'user_id',
      });
    }
    await this.sapQueue.add('create-rental-order', {
      repair_order_rental_phone_id: inserted.id,
      cardCode: user.sap_card_code,
      itemCode: device.code,
      startDate: new Date().toISOString().split('T')[0],
    });
  }

  async insertAssignAdmins(
    trx: Knex.Transaction,
    dto: CreateRepairOrderDto,
    admin: AdminPayload,
    statusId: string,
    orderId: string,
    branchId: string,
    allPermissions: RepairOrderStatusPermission[],
  ): Promise<void> {
    if (!dto.admin_ids?.length) return;

    await this.permissionService.checkPermissionsOrThrow(
      admin.roles,
      branchId,
      statusId,
      ['can_assign_admin'],
      'repair_order_assign_admins',
      allPermissions,
    );

    const uniqueIds: string[] = [...new Set(dto.admin_ids)];

    const existing = await trx('admins').whereIn('id', uniqueIds).pluck('id');

    const notFound: string[] = uniqueIds.filter((id) => !existing.includes(id));
    if (notFound.length) {
      throw new BadRequestException({
        message: 'Admin(s) not found',
        location: 'admin_ids',
        missing_ids: notFound,
      });
    }

    const now = new Date();

    const rows = uniqueIds.map((id) => ({
      repair_order_id: orderId,
      admin_id: id,
      created_at: now,
    }));
    await trx('repair_order_assign_admins').insert(rows);

    const order = await trx('repair_orders').where({ id: orderId }).first();

    if (order) {
      const notifications = uniqueIds.map((adminId) => ({
        admin_id: adminId,
        title: 'Yangi buyurtma tayinlandi',
        message: 'Sizga yangi repair order biriktirildi.',
        type: 'info',
        meta: {
          order_id: order.id,
          branch_id: order.branch_id,
          assigned_by: adminId,
          action: 'assigned_to_order',
        },
        created_at: now,
        updated_at: now,
      }));

      await trx('notifications').insert(notifications);

      await this.notificationService.notifyAdmins(trx, uniqueIds, {
        title: 'Yangi buyurtma',
        message: 'Sizga yangi buyurtma biriktirildi.',
        meta: {
          order_id: order.id,
          action: 'assigned_to_order',
        },
      });
    }
  }

  async insertInitialProblems(
    trx: Knex.Transaction,
    dto: CreateRepairOrderDto,
    admin: AdminPayload,
    statusId: string,
    orderId: string,
    branchId: string,
    allPermissions: RepairOrderStatusPermission[],
  ): Promise<void> {
    await validateAndInsertProblems(
      trx,
      dto?.initial_problems || [],
      dto.phone_category_id,
      admin,
      statusId,
      branchId,
      orderId,
      allPermissions,
      ['can_change_initial_problems'],
      'initial_problems',
      'repair_order_initial_problems',
      this.permissionService.checkPermissionsOrThrow.bind(this.permissionService),
    );
  }

  async insertFinalProblems(
    trx: Knex.Transaction,
    dto: CreateRepairOrderDto,
    admin: AdminPayload,
    statusId: string,
    orderId: string,
    branchId: string,
    allPermissions: RepairOrderStatusPermission[],
  ): Promise<void> {
    await validateAndInsertProblems(
      trx,
      dto?.final_problems || [],
      dto.phone_category_id,
      admin,
      statusId,
      branchId,
      orderId,
      allPermissions,
      ['can_change_final_problems'],
      'final_problems',
      'repair_order_final_problems',
      this.permissionService.checkPermissionsOrThrow.bind(this.permissionService),
    );
  }

  async insertComments(
    trx: Knex.Transaction,
    dto: CreateRepairOrderDto,
    admin: AdminPayload,
    statusId: string,
    orderId: string,
    branchId: string,
    allPermissions: RepairOrderStatusPermission[],
  ): Promise<void> {
    if (!dto.comments?.length) return;

    await this.permissionService.checkPermissionsOrThrow(
      admin.roles,
      branchId,
      statusId,
      ['can_comment'],
      'repair_order_comments',
      allPermissions,
    );

    const rows = dto.comments.map((c) => ({
      repair_order_id: orderId,
      text: c.text,
      status: 'Open',
      created_by: admin.id,
      status_by: statusId,
      created_at: new Date(),
      updated_at: new Date(),
    }));

    await trx('repair_order_comments').insert(rows);
  }

  async insertPickup(
    trx: Knex.Transaction,
    dto: CreateRepairOrderDto,
    admin: AdminPayload,
    statusId: string,
    orderId: string,
    branchId: string,
    allPermissions: RepairOrderStatusPermission[],
  ): Promise<void> {
    if (!dto.pickup) return;

    if (dto?.pickup?.courier_id) {
      const courier = await trx('admins')
        .where({ id: dto.pickup.courier_id, is_active: true, status: 'Open' })
        .first();
      if (!courier) {
        throw new BadRequestException({
          message: 'Courier not found or inactive',
          location: 'courier_id',
        });
      }
    }

    await this.permissionService.checkPermissionsOrThrow(
      admin.roles,
      branchId,
      statusId,
      ['can_pickup_manage'],
      'repair_order_comments',
      allPermissions,
    );

    await trx('repair_order_pickups').insert({
      repair_order_id: orderId,
      ...dto.pickup,
      created_by: admin.id,
      created_at: new Date(),
      updated_at: new Date(),
    });
  }

  async insertDelivery(
    trx: Knex.Transaction,
    dto: CreateRepairOrderDto,
    admin: AdminPayload,
    statusId: string,
    orderId: string,
    branchId: string,
    allPermissions: RepairOrderStatusPermission[],
  ): Promise<void> {
    if (!dto.delivery) return;

    if (dto?.delivery?.courier_id) {
      const courier = await trx('admins')
        .where({ id: dto.delivery.courier_id, is_active: true, status: 'Open' })
        .first();
      if (!courier) {
        throw new BadRequestException({
          message: 'Courier not found or inactive',
          location: 'courier_id',
        });
      }
    }

    await this.permissionService.checkPermissionsOrThrow(
      admin.roles,
      branchId,
      statusId,
      ['can_delivery_manage'],
      'repair_order_comments',
      allPermissions,
    );

    await trx('repair_order_deliveries').insert({
      repair_order_id: orderId,
      ...dto.delivery,
      created_by: admin.id,
      created_at: new Date(),
      updated_at: new Date(),
    });
  }
}
