import { BadRequestException, Injectable } from '@nestjs/common';
import { RepairOrderStatusPermissionsService } from 'src/repair-order-status-permission/repair-order-status-permissions.service';
import { RepairOrderChangeLoggerService } from './repair-order-change-logger.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Knex } from 'knex';

@Injectable()
export class RentalPhoneUpdaterService {
    constructor(
        private readonly permissionService: RepairOrderStatusPermissionsService,
        private readonly changeLogger: RepairOrderChangeLoggerService,
        @InjectQueue('sap') private readonly sapQueue: Queue,
        private readonly knex: Knex,
    ) { }

    async update(trx: Knex.Transaction, orderId: string, rental: any, adminId: string, statusId: string) {
        const old = await trx('repair_order_rental_phones')
            .where({ repair_order_id: orderId })
            .first();

        if (old) {
            await trx('rental_phone_devices')
                .where({ id: old.rental_phone_device_id })
                .update({ is_available: true, updated_at: new Date() });

            if (old.sap_order_id) {
                await this.sapQueue.add('cancel-rental-order', {
                    sap_order_id: old.sap_order_id,
                });
            }

            await trx('repair_order_rental_phones')
                .where({ repair_order_id: orderId })
                .delete();
        }

        if (!rental) {
            await this.changeLogger.logIfChanged(trx, orderId, 'rental_phone', old, null, adminId);
            return;
        }

        await this.permissionService.validatePermissionOrThrow(
            adminId,
            statusId,
            'can_manage_rental_phone',
            'repair_order_rental_phones',
        );

        const device = await trx('rental_phone_devices')
            .where({ id: rental.rental_phone_device_id, is_available: true })
            .first();

        if (!device) {
            throw new BadRequestException({
                message: 'Rental phone device not found or already in use',
                location: 'rental_phone.rental_phone_device_id',
            });
        }

        const [inserted] = await trx('repair_order_rental_phones')
            .insert({
                repair_order_id: orderId,
                rental_phone_device_id: rental.rental_phone_device_id,
                is_free: rental.is_free ?? null,
                price: rental.price ?? null,
                currency: rental.currency ?? 'UZS',
                status: 'Active',
                rented_at: new Date(),
                returned_at: null,
                notes: rental.notes ?? null,
                created_by: adminId,
                created_at: new Date(),
                updated_at: new Date(),
            })
            .returning('*');

        await trx('rental_phone_devices')
            .where({ id: rental.rental_phone_device_id })
            .update({ is_available: false, updated_at: new Date() });

        const order = await trx('repair_orders').where({ id: orderId }).first();
        const user = await trx('users').where({ id: order.user_id }).first();

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

        await this.changeLogger.logIfChanged(trx, orderId, 'rental_phone', old, rental, adminId);
    }
}
