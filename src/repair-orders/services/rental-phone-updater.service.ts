import { BadRequestException, Injectable } from '@nestjs/common';
import { RepairOrderStatusPermissionsService } from 'src/repair-order-status-permission/repair-order-status-permissions.service';
import { RepairOrderChangeLoggerService } from './repair-order-change-logger.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Knex } from 'knex';
import { InjectKnex } from 'nestjs-knex';

@Injectable()
export class RentalPhoneUpdaterService {
    constructor(
        private readonly permissionService: RepairOrderStatusPermissionsService,
        private readonly changeLogger: RepairOrderChangeLoggerService,
        @InjectQueue('sap') private readonly sapQueue: Queue,
        @InjectKnex() private readonly knex: Knex,
    ) { }

    async create(orderId: string, rental: any, adminId: string) {
        const status = await this.knex('repair_orders')
            .select('status_id', 'user_id')
            .where({ id: orderId })
            .first();

        if (!status) {
            throw new BadRequestException({
                message: 'Repair order not found',
                location: 'repair_order_id',
            });
        }

        const statusId = status.status_id;

        await this.permissionService.validatePermissionOrThrow(
            adminId,
            statusId,
            'can_manage_rental_phone',
            'repair_order_rental_phones',
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

        const device = await this.knex('rental_phone_devices')
            .where({ id: rental.rental_phone_device_id })
            .first();

        if (!device) {
            throw new BadRequestException({
                message: 'Rental phone device not found',
                location: 'rental_phone.rental_phone_device_id',
            });
        }

        const now = new Date();

        const [inserted] = await this.knex('repair_order_rental_phones')
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
                created_by: adminId,
                created_at: now,
                updated_at: now,
            })
            .returning('*');

        const user = await this.knex('users')
            .where({ id: status.user_id })
            .first();

        if (user?.sap_card_code) {
            await this.sapQueue.add('create-rental-order', {
                repair_order_rental_phone_id: inserted.id,
                cardCode: user.sap_card_code,
                itemCode: device.code,
                startDate: now.toISOString().split('T')[0],
            });
        }

        await this.changeLogger.logIfChanged(this.knex, orderId, 'rental_phone', null, rental, adminId);

        return inserted;
    }

    async update(orderId: string, rental: any, adminId: string) {
        const status = await this.knex('repair_orders')
            .select('status_id')
            .where({ id: orderId })
            .first();

        if (!status) {
            throw new BadRequestException({
                message: 'Repair order not found',
                location: 'repair_order_id',
            });
        }

        const statusId = status.status_id;

        await this.permissionService.validatePermissionOrThrow(
            adminId,
            statusId,
            'can_manage_rental_phone',
            'repair_order_rental_phones',
        );

        const existing = await this.knex('repair_order_rental_phones')
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
                message: 'Cannot change rental phone device after assignment. Please cancel and create again.',
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

        await this.changeLogger.logIfChanged(this.knex, orderId, 'rental_phone', existing, rental, adminId);

        return { message: 'Rental phone updated' };
    }

    async delete(orderId: string, adminId: string) {
        const status = await this.knex('repair_orders')
            .select('status_id')
            .where({ id: orderId })
            .first();

        if (!status) {
            throw new BadRequestException({
                message: 'Repair order not found',
                location: 'repair_order_id',
            });
        }

        const statusId = status.status_id;

        await this.permissionService.validatePermissionOrThrow(
            adminId,
            statusId,
            'can_manage_rental_phone',
            'repair_order_rental_phones',
        );

        const existing = await this.knex('repair_order_rental_phones')
            .where({ repair_order_id: orderId, status: 'Active' })
            .first();

        if (!existing) return;

        await this.knex('repair_order_rental_phones')
            .where({ id: existing.id })
            .update({ status: 'Cancelled', updated_at: new Date() });

        if (existing.sap_order_id) {
            await this.sapQueue.add('cancel-rental-order', {
                sap_order_id: existing.sap_order_id,
            });
        }

        await this.changeLogger.logIfChanged(this.knex, orderId, 'rental_phone', existing, null, adminId);
    }
}
