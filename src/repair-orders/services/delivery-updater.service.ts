import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import { RepairOrderStatusPermissionsService } from 'src/repair-order-status-permission/repair-order-status-permissions.service';
import { RepairOrderChangeLoggerService } from './repair-order-change-logger.service';
import { RepairOrder } from 'src/common/types/repair-order.interface';
import { RepairOrderDelivery } from 'src/common/types/delivery-and-pickup.interface';
import { CreateOrUpdateDeliveryDto } from 'src/repair-orders/dto/create-or-update-delivery.dto';

@Injectable()
export class DeliveryUpdaterService {
  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly permissionService: RepairOrderStatusPermissionsService,
    private readonly changeLogger: RepairOrderChangeLoggerService,
  ) {}

  async create(
    orderId: string,
    delivery: CreateOrUpdateDeliveryDto,
    adminId: string,
  ): Promise<RepairOrderDelivery | undefined> {
    if (!delivery) return;

    const status: RepairOrder | undefined = await this.knex('repair_orders')
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
      'can_pickup_manage',
      'delivery',
    );

    if (delivery?.courier_id) {
      const courier = await this.knex('admins')
        .where({ id: delivery.courier_id, is_active: true, status: 'Open' })
        .first();
      if (!courier) {
        throw new BadRequestException({
          message: 'Courier not found or inactive',
          location: 'courier_id',
        });
      }
    }

    const now = new Date();

    const row = {
      courier_id: delivery.courier_id,
      repair_order_id: orderId,
      lat: delivery.lat,
      long: delivery.long,
      description: delivery.description,
      created_by: adminId,
      created_at: now,
      updated_at: now,
    };

    const [result]: RepairOrderDelivery[] = await this.knex('repair_order_deliveries')
      .insert(row)
      .returning('*');

    await this.changeLogger.logIfChanged(this.knex, orderId, 'delivery', null, result, adminId);

    return result;
  }

  async update(
    orderId: string,
    delivery: CreateOrUpdateDeliveryDto,
    adminId: string,
  ): Promise<{ message: string } | undefined> {
    if (!delivery) return;

    const status: RepairOrder | undefined = await this.knex('repair_orders')
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
      'can_pickup_manage',
      'delivery',
    );

    if (delivery?.courier_id) {
      const courier = await this.knex('admins')
        .where({ id: delivery.courier_id, is_active: true, status: 'Open' })
        .first();
      if (!courier) {
        throw new BadRequestException({
          message: 'Courier not found or inactive',
          location: 'courier_id',
        });
      }
    }

    const old = await this.knex('repair_order_deliveries')
      .where({ repair_order_id: orderId })
      .first();

    await this.knex('repair_order_deliveries').where({ repair_order_id: orderId }).delete();

    const now = new Date();

    const row = {
      courier_id: delivery.courier_id,
      repair_order_id: orderId,
      lat: delivery.lat,
      long: delivery.long,
      description: delivery.description,
      created_by: adminId,
      created_at: now,
      updated_at: now,
    };

    await this.knex('repair_order_deliveries').insert(row);
    await this.changeLogger.logIfChanged(this.knex, orderId, 'delivery', old, row, adminId);

    return { message: '✅ Delivery updated' };
  }

  async delete(orderId: string, adminId: string): Promise<{ message: string } | undefined> {
    const status: RepairOrder | undefined = await this.knex('repair_orders')
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
      'can_pickup_manage',
      'delivery',
    );

    const old = await this.knex('repair_order_deliveries')
      .where({ repair_order_id: orderId })
      .first();

    if (!old) return;

    await this.knex('repair_order_deliveries').where({ repair_order_id: orderId }).delete();

    await this.changeLogger.logIfChanged(this.knex, orderId, 'delivery', old, null, adminId);

    return { message: '🗑️ Delivery deleted' };
  }
}
