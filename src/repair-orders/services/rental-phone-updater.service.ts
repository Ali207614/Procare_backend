import { BadRequestException, Injectable } from '@nestjs/common';
import { RepairOrderStatusPermissionsService } from 'src/repair-order-status-permission/repair-order-status-permissions.service';
import { RepairOrderChangeLoggerService } from './repair-order-change-logger.service';
import { Knex } from 'knex';
import { InjectKnex } from 'nestjs-knex';
import { RepairOrder } from 'src/common/types/repair-order.interface';
import { RentalPhone } from 'src/common/types/rental-phone.interface';
import { RepairOrderRentalPhone } from 'src/common/types/repair-order-rental-phone.interface';
import { CreateOrUpdateRentalPhoneDto } from 'src/repair-orders/dto/create-or-update-rental-phone.dto';
import { UpdateRentalPhoneDto } from 'src/repair-orders/dto/update-rental-phone.dto';
import { NotFoundException } from '@nestjs/common';
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

    const device: RentalPhone | undefined = await this.knex('rental_phone_devices')
      .where({ id: rental.rental_phone_id, status: 'Available', is_active: true })
      .first();

    if (!device) {
      throw new BadRequestException({
        message: 'Rental phone not found',
        location: 'rental_phone.rental_phone_id',
      });
    }

    const now = new Date();

    const [inserted]: RepairOrderRentalPhone[] = await this.knex('repair_order_rental_phones')
      .insert({
        repair_order_id: orderId,
        rental_phone_id: rental.rental_phone_id,
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

    // User details could be fetched here if needed for external integrations

    // External system integration removed

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

    if (existing.rental_phone_id !== rental.rental_phone_id) {
      throw new BadRequestException({
        message: 'Cannot change rental phone after assignment. Please cancel and create again.',
        location: 'rental_phone.rental_phone_id',
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

    // External system integration removed

    await this.changeLogger.logIfChanged(
      this.knex,
      orderId,
      'rental_phone',
      existing,
      null,
      admin.id,
    );
  }

  async updateRentalPhone(
    repairOrderId: string,
    rentalPhoneId: string,
    updateDto: UpdateRentalPhoneDto,
    admin: AdminPayload,
  ): Promise<RepairOrderRentalPhone> {
    const order: RepairOrder | undefined = await this.knex('repair_orders')
      .where({ id: repairOrderId })
      .first();

    if (!order) {
      throw new NotFoundException('Repair order not found');
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

    const existingRental = await this.knex('repair_order_rental_phones')
      .where({ id: rentalPhoneId, repair_order_id: repairOrderId })
      .first();

    if (!existingRental) {
      throw new NotFoundException('Rental phone not found');
    }

    const updateFields: Partial<RepairOrderRentalPhone> = {};
    if (updateDto.rental_phone_device_id !== undefined)
      updateFields.rental_phone_id = updateDto.rental_phone_device_id;
    if (updateDto.is_free !== undefined) updateFields.is_free = updateDto.is_free;
    if (updateDto.rental_price !== undefined)
      updateFields.price = updateDto.rental_price.toString();

    if (Object.keys(updateFields).length === 0) {
      throw new BadRequestException('No valid fields to update');
    }

    updateFields.updated_at = new Date().toISOString();

    const updated = await this.knex('repair_order_rental_phones')
      .where({ id: rentalPhoneId })
      .update(updateFields)
      .returning('*');

    await this.changeLogger.logChange(
      repairOrderId,
      'rental_phone_updated',
      updateFields,
      admin.id,
    );
    return updated[0] as RepairOrderRentalPhone;
  }

  async removeRentalPhone(
    repairOrderId: string,
    rentalPhoneId: string,
    admin: AdminPayload,
  ): Promise<{ message: string }> {
    const order: RepairOrder | undefined = await this.knex('repair_orders')
      .where({ id: repairOrderId })
      .first();

    if (!order) {
      throw new NotFoundException('Repair order not found');
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

    const deleted = await this.knex('repair_order_rental_phones')
      .where({ id: rentalPhoneId, repair_order_id: repairOrderId })
      .del()
      .returning('*');

    if (!deleted.length) {
      throw new NotFoundException('Rental phone not found');
    }

    await this.changeLogger.logChange(
      repairOrderId,
      'rental_phone_removed',
      {
        rental_phone_id: rentalPhoneId,
      },
      admin.id,
    );

    return { message: 'Rental phone removed successfully' };
  }
}
