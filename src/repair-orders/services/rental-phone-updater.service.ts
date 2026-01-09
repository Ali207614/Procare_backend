import { BadRequestException, Injectable } from '@nestjs/common';
import { RepairOrderStatusPermissionsService } from 'src/repair-order-status-permission/repair-order-status-permissions.service';
import { RepairOrderChangeLoggerService } from './repair-order-change-logger.service';
import { Knex } from 'knex';
import { InjectKnex } from 'nestjs-knex';
import { RepairOrder } from 'src/common/types/repair-order.interface';
import { RentalPhoneDevice } from 'src/common/types/rental-phone-device.interface';
import { RepairOrderRentalPhone } from 'src/common/types/repair-order-rental-phone.interface';
import { CreateOrUpdateRentalPhoneDto } from 'src/repair-orders/dto/create-or-update-rental-phone.dto';
import { RepairOrderStatusPermission } from 'src/common/types/repair-order-status-permssion.interface';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { LoggerService } from 'src/common/logger/logger.service';

@Injectable()
export class RentalPhoneUpdaterService {
  constructor(
    private readonly permissionService: RepairOrderStatusPermissionsService,
    private readonly changeLogger: RepairOrderChangeLoggerService,
    private readonly logger: LoggerService,
    @InjectKnex() private readonly knex: Knex,
  ) {}

  async create(
    orderId: string,
    rental: CreateOrUpdateRentalPhoneDto,
    admin: AdminPayload,
  ): Promise<RepairOrderRentalPhone> {
    const order: RepairOrder | undefined = await this.knex('repair_orders')
      .where({ id: orderId })
      .first();

    if (!order) {
      throw new BadRequestException({
        message: 'Repair order not found',
        location: 'repair_order_id',
      });
    }

    const allPermissions: RepairOrderStatusPermission[] =
      await this.permissionService.findByRolesAndBranch(admin.roles, order.branch_id);
    await this.permissionService.checkPermissionsOrThrow(
      admin.roles,
      order.branch_id,
      order.status_id,
      ['can_pickup_manage'],
      'repair_order_delivery',
      allPermissions,
    );

    const existing = await this.knex('repair_order_rental_phones')
      .where({ repair_order_id: orderId, status: 'Active' })
      .first();

    if (existing) {
      throw new BadRequestException({
        message: 'Rental phone already assigned to this repair order',
        location: 'repair_order_id',
      });
    }

    const device: RentalPhoneDevice | undefined = await this.knex('rental_phone_devices')
      .where({ id: rental.rental_phone_device_id })
      .first();

    if (!device) {
      throw new BadRequestException({
        message: 'Rental phone device not found',
        location: 'rental_phone.rental_phone_device_id',
      });
    }

    const now = new Date();

    const [inserted]: RepairOrderRentalPhone[] = await this.knex('repair_order_rental_phones')
      .insert({
        repair_order_id: orderId,
        rental_phone_device_id: rental.rental_phone_device_id,
        is_free: rental.is_free ?? null,
        price: rental.price ?? null,
        currency: rental.currency ?? 'UZS',
        status: 'Active',
        rented_at: now,
        returned_at: null,
        notes: rental.notes ?? null,
        created_by: admin.id,
        created_at: now,
        updated_at: now,
      })
      .returning('*');

    const user = await this.knex('users').where({ id: order.user_id }).first();

    // SAP integration removed

    await this.changeLogger.logIfChanged(
      this.knex,
      orderId,
      'rental_phone',
      null,
      rental,
      admin.id,
    );

    return inserted;
  }

  async update(
    orderId: string,
    rental: CreateOrUpdateRentalPhoneDto,
    admin: AdminPayload,
  ): Promise<{ message: string }> {
    const order: RepairOrder | undefined = await this.knex('repair_orders')
      .select('status_id')
      .where({ id: orderId })
      .first();

    if (!order) {
      throw new BadRequestException({
        message: 'Repair order not found',
        location: 'repair_order_id',
      });
    }

    const allPermissions: RepairOrderStatusPermission[] =
      await this.permissionService.findByRolesAndBranch(admin.roles, order.branch_id);
    await this.permissionService.checkPermissionsOrThrow(
      admin.roles,
      order.branch_id,
      order.status_id,
      ['can_pickup_manage'],
      'repair_order_delivery',
      allPermissions,
    );

    const existing: RepairOrderRentalPhone | undefined = await this.knex(
      'repair_order_rental_phones',
    )
      .where({ repair_order_id: orderId, status: 'Active' })
      .first();

    if (!existing) {
      throw new BadRequestException({
        message: 'No active rental phone found for this repair order',
        location: 'repair_order_id',
      });
    }

    if (existing.rental_phone_device_id !== rental.rental_phone_device_id) {
      throw new BadRequestException({
        message:
          'Cannot change rental phone device after assignment. Please cancel and create again.',
        location: 'rental_phone.rental_phone_device_id',
      });
    }

    const now = new Date();

    await this.knex('repair_order_rental_phones')
      .where({ id: existing.id })
      .update({
        is_free: rental.is_free ?? existing.is_free,
        price: rental.price ?? existing.price,
        currency: rental.currency ?? existing.currency,
        notes: rental.notes ?? existing.notes,
        updated_at: now,
      });

    await this.changeLogger.logIfChanged(
      this.knex,
      orderId,
      'rental_phone',
      existing,
      rental,
      admin.id,
    );

    return { message: 'Rental phone updated' };
  }

  async delete(orderId: string, admin: AdminPayload): Promise<void> {
    const order: RepairOrder | undefined = await this.knex<RepairOrder>('repair_orders')
      .where({ id: orderId })
      .first();

    if (!order) {
      throw new BadRequestException({
        message: 'Repair order not found',
        location: 'repair_order_id',
      });
    }

    const allPermissions: RepairOrderStatusPermission[] =
      await this.permissionService.findByRolesAndBranch(admin.roles, order.branch_id);
    await this.permissionService.checkPermissionsOrThrow(
      admin.roles,
      order.branch_id,
      order.status_id,
      ['can_pickup_manage'],
      'repair_order_delivery',
      allPermissions,
    );
    const existing: RepairOrderRentalPhone | undefined = await this.knex(
      'repair_order_rental_phones',
    )
      .where({ repair_order_id: orderId, status: 'Active' })
      .first();

    if (!existing) {
      throw new BadRequestException({
        message: 'No active rental phone found for this repair order',
        location: 'repair_order_id',
      });
    }

    await this.knex('repair_order_rental_phones')
      .where({ id: existing.id })
      .update({ status: 'Cancelled', updated_at: new Date() });

    // SAP integration removed

    await this.changeLogger.logIfChanged(
      this.knex,
      orderId,
      'rental_phone',
      existing,
      null,
      admin.id,
    );
  }
}
