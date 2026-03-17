import { BadRequestException, Injectable } from '@nestjs/common';
import { RepairOrderStatusPermissionsService } from 'src/repair-order-status-permission/repair-order-status-permissions.service';
import { RepairOrderChangeLoggerService } from './repair-order-change-logger.service';
import { Knex } from 'knex';
import { InjectKnex } from 'nestjs-knex';
import { RepairOrder } from 'src/common/types/repair-order.interface';
import { RentalPhoneDevice } from 'src/common/types/rental-phone-device.interface';
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

    // Check if repair order is in a status that doesn't allow rental phones
    const orderStatus = await this.knex('repair_order_statuses')
      .where({ id: order.status_id })
      .first();

    if (orderStatus && (orderStatus.type === 'Canceled' || orderStatus.type === 'Completed')) {
      throw new BadRequestException({
        message: `Cannot assign rental phone to a ${orderStatus.type.toLowerCase()} repair order`,
        location: 'repair_order_id',
      });
    }

    let device: RentalPhoneDevice | undefined;
    if (rental.status === 'Active' && rental.rental_phone_id) {
      device = await this.knex('rental_phone_devices')
        .where({ id: rental.rental_phone_id, status: 'Available', is_available: true })
        .first();

      if (!device) {
        throw new BadRequestException({
          message: 'Rental phone not found',
          location: 'rental_phone.rental_phone_id',
        });
      }
    }

    const now = new Date();
    const insertData: Partial<RepairOrderRentalPhone> = {
      repair_order_id: orderId,
      status: rental.status,
      created_by: admin.id,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    if (rental.status === 'Active') {
      insertData.rental_phone_device_id = rental.rental_phone_id;
      insertData.imei = rental.imei ?? null;
      insertData.is_free = rental.is_free ?? null;
      insertData.price = (rental.price ?? (device ? device.daily_rent_price : null))?.toString();
      insertData.currency = rental.currency ?? (device ? device.currency : null);
      insertData.rented_at = rental.rented_at ? new Date(rental.rented_at).toISOString() : null;
      insertData.returned_at = rental.returned_at
        ? new Date(rental.returned_at).toISOString()
        : null;
      insertData.notes = rental.notes ?? null;
    }

    const [inserted]: RepairOrderRentalPhone[] = await this.knex('repair_order_rental_phones')
      .insert(insertData)
      .returning('*');

    if (rental.status === 'Active' && rental.rental_phone_id) {
      await this.knex('rental_phone_devices')
        .where({ id: rental.rental_phone_id })
        .update({ status: 'Rented', updated_at: now });
    }

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

    return {
      ...inserted,
      toggle: inserted.status === 'Pending',
    };
  }

  async update(
    orderId: string,
    rental: CreateOrUpdateRentalPhoneDto,
    admin: AdminPayload,
  ): Promise<{ message: string }> {
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

    const existing: RepairOrderRentalPhone | undefined = await this.knex(
      'repair_order_rental_phones',
    )
      .where({ repair_order_id: orderId })
      .orderBy('created_at', 'desc')
      .first();

    if (!existing) {
      throw new BadRequestException({
        message: 'No rental phone records found for this repair order',
        location: 'repair_order_id',
      });
    }

    const currentStatus = existing.status;
    const newStatus = rental.status || currentStatus;

    if (currentStatus !== newStatus) {
      // Logic for status transitions as requested
      if (currentStatus === 'Active' && newStatus === 'Pending') {
        throw new BadRequestException({
          message: 'Status transition from Active to Pending is not allowed',
          location: 'status',
        });
      }

      if (['Cancelled', 'Returned'].includes(currentStatus)) {
        throw new BadRequestException({
          message: `Cannot change status once it is ${currentStatus}`,
          location: 'status',
        });
      }
    }

    // "Also if it wants to transfer the status from Pending to Active, it must provide these fields: rental_phone_id, rented_at, returned_at and price"
    if (currentStatus === 'Pending' && newStatus === 'Active') {
      const missingFields = [];
      if (!rental.rental_phone_id) missingFields.push('rental_phone_id');
      if (!rental.rented_at) missingFields.push('rented_at');
      if (!rental.returned_at) missingFields.push('returned_at');
      if (rental.price === undefined || rental.price === null) missingFields.push('price');

      if (missingFields.length > 0) {
        throw new BadRequestException({
          message: `Fields required for Active status transition: ${missingFields.join(', ')}`,
          location: 'status',
        });
      }
    }

    // Safety: check rental phone ID change if already assigned
    if (
      rental.rental_phone_id &&
      existing.rental_phone_device_id &&
      existing.rental_phone_device_id !== rental.rental_phone_id
    ) {
      throw new BadRequestException({
        message: 'Cannot change rental phone after assignment. Please cancel and create again.',
        location: 'rental_phone.rental_phone_id',
      });
    }

    const now = new Date();
    const updateFields: Partial<RepairOrderRentalPhone> = {
      status: newStatus as RepairOrderRentalPhone['status'],
      updated_at: now.toISOString(),
    };

    if (rental.is_free !== undefined) updateFields.is_free = rental.is_free;
    if (rental.price !== undefined) updateFields.price = rental.price?.toString();
    if (rental.currency !== undefined) updateFields.currency = rental.currency;
    if (rental.notes !== undefined) updateFields.notes = rental.notes;
    if (rental.imei !== undefined) updateFields.imei = rental.imei;

    if (rental.rented_at !== undefined) {
      updateFields.rented_at = rental.rented_at ? new Date(rental.rented_at).toISOString() : null;
    }
    if (rental.returned_at !== undefined) {
      updateFields.returned_at = rental.returned_at
        ? new Date(rental.returned_at).toISOString()
        : null;
    }

    // Specialized transition handling
    if (currentStatus === 'Pending' && newStatus === 'Active') {
      const device = await this.knex('rental_phone_devices')
        .where({ id: rental.rental_phone_id, status: 'Available', is_available: true })
        .first();

      if (!device) {
        throw new BadRequestException({
          message: 'Selected rental phone is not found or not available',
          location: 'rental_phone_id',
        });
      }

      updateFields.rental_phone_device_id = rental.rental_phone_id;

      // Mark device as Rented
      await this.knex('rental_phone_devices')
        .where({ id: rental.rental_phone_id })
        .update({ status: 'Rented', updated_at: now });
    }

    // Release device if status becomes terminal
    if (currentStatus === 'Active' && ['Cancelled', 'Returned'].includes(newStatus)) {
      if (newStatus === 'Cancelled') {
        updateFields.marked_as_cancelled_by = admin.id;
      } else {
        updateFields.marked_as_returned_by = admin.id;
      }

      if (existing.rental_phone_device_id) {
        await this.knex('rental_phone_devices')
          .where({ id: existing.rental_phone_device_id })
          .update({ status: 'Available', updated_at: now });
      }
    }

    await this.knex('repair_order_rental_phones').where({ id: existing.id }).update(updateFields);

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

    await this.knex('repair_order_rental_phones').where({ id: existing.id }).update({
      status: 'Cancelled',
      marked_as_cancelled_by: admin.id,
      updated_at: new Date(),
    });

    await this.knex('rental_phone_devices')
      .where({ id: existing.rental_phone_device_id })
      .update({ status: 'Available', updated_at: new Date() });

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
    if (updateDto.rental_phone_device_id !== undefined) {
      if (updateDto.rental_phone_device_id !== existingRental.rental_phone_device_id) {
        // Mark old device as available
        await this.knex('rental_phone_devices')
          .where({ id: existingRental.rental_phone_device_id })
          .update({ status: 'Available', updated_at: new Date() });

        // Mark new device as rented
        await this.knex('rental_phone_devices')
          .where({ id: updateDto.rental_phone_device_id })
          .update({ status: 'Rented', updated_at: new Date() });
      }
      updateFields.rental_phone_device_id = updateDto.rental_phone_device_id;
    }
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
    const updatedRental = updated[0] as RepairOrderRentalPhone;
    return {
      ...updatedRental,
      toggle: updatedRental.status === 'Pending',
    };
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

    await this.knex('rental_phone_devices')
      .where({ id: deleted[0].rental_phone_device_id })
      .update({ status: 'Available', updated_at: new Date() });

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
