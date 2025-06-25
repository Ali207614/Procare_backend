import { InjectQueue } from '@nestjs/bull';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import type { Knex } from 'knex';
import { NotificationService } from 'src/notification/notification.service';
import { RepairOrderStatusPermissionsService } from 'src/repair-order-status-permission/repair-order-status-permissions.service';
import { CreateRepairOrderDto } from '../dto/create-repair-order.dto';

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
    adminId: string,
    statusId: string,
    orderId: string,
  ) {
    if (!dto.rental_phone) return;

    await this.permissionService.validatePermissionOrThrow(
      adminId,
      statusId,
      'can_manage_rental_phone',
      'repair_order_rental_phones',
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
        created_by: adminId,
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
    adminId: string,
    statusId: string,
    orderId: string,
  ) {
    if (!dto.admin_ids?.length) return;

    await this.permissionService.validatePermissionOrThrow(
      adminId,
      statusId,
      'can_assign_admin',
      'admin_ids',
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
    adminId: string,
    statusId: string,
    orderId: string,
  ) {
    if (!dto.initial_problems?.length) return;

    await this.permissionService.validatePermissionOrThrow(
      adminId,
      statusId,
      'can_change_initial_problems',
      'initial_problems',
    );

    const phoneCategoryId = dto.phone_category_id;
    const problemIds = dto.initial_problems.map((p) => p.problem_category_id);

    const mappings = await trx('phone_problem_mappings')
      .where({ phone_category_id: phoneCategoryId })
      .whereIn('problem_category_id', problemIds)
      .pluck('problem_category_id');

    const invalidProblems = problemIds.filter((id) => !mappings.includes(id));

    if (invalidProblems.length) {
      throw new BadRequestException({
        message: 'Some problems are not allowed for this phone category',
        location: 'initial_problems',
        invalid_problem_ids: invalidProblems,
      });
    }

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

  async insertFinalProblems(
    trx: Knex.Transaction,
    dto: CreateRepairOrderDto,
    adminId: string,
    statusId: string,
    orderId: string,
  ) {
    if (!dto.final_problems?.length) return;

    await this.permissionService.validatePermissionOrThrow(
      adminId,
      statusId,
      'can_change_final_problems',
      'final_problems',
    );

    const phoneCategoryId = dto.phone_category_id;
    const problemIds = dto.final_problems.map((p) => p.problem_category_id);

    const mappings = await trx('phone_problem_mappings')
      .where({ phone_category_id: phoneCategoryId })
      .whereIn('problem_category_id', problemIds)
      .pluck('problem_category_id');

    const invalidProblems = problemIds.filter((id) => !mappings.includes(id));

    if (invalidProblems.length) {
      throw new BadRequestException({
        message: 'Some final problems are not allowed for this phone category',
        location: 'final_problems',
        invalid_problem_ids: invalidProblems,
      });
    }

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

  async insertComments(
    trx: Knex.Transaction,
    dto: CreateRepairOrderDto,
    adminId: string,
    statusId: string,
    orderId: string,
  ) {
    if (!dto.comments?.length) return;

    await this.permissionService.validatePermissionOrThrow(
      adminId,
      statusId,
      'can_comment',
      'comments',
    );

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

  async insertPickup(
    trx: Knex.Transaction,
    dto: CreateRepairOrderDto,
    adminId: string,
    statusId: string,
    orderId: string,
  ) {
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

    await this.permissionService.validatePermissionOrThrow(
      adminId,
      statusId,
      'can_pickup_manage',
      'pickup',
    );

    await trx('repair_order_pickups').insert({
      repair_order_id: orderId,
      ...dto.pickup,
      created_by: adminId,
      created_at: new Date(),
      updated_at: new Date(),
    });
  }

  async insertDelivery(
    trx: Knex.Transaction,
    dto: CreateRepairOrderDto,
    adminId: string,
    statusId: string,
    orderId: string,
  ) {
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

    await this.permissionService.validatePermissionOrThrow(
      adminId,
      statusId,
      'can_delivery_manage',
      'delivery',
    );

    await trx('repair_order_deliveries').insert({
      repair_order_id: orderId,
      ...dto.delivery,
      created_by: adminId,
      created_at: new Date(),
      updated_at: new Date(),
    });
  }
}
