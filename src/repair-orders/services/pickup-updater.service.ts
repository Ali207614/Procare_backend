import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import { RepairOrderStatusPermissionsService } from 'src/repair-order-status-permission/repair-order-status-permissions.service';
import { RepairOrderChangeLoggerService } from './repair-order-change-logger.service';
import { RepairOrder } from 'src/common/types/repair-order.interface';
import { RepairOrderPickup } from 'src/common/types/delivery-and-pickup.interface';
import { CreateOrUpdatePickupDto } from 'src/repair-orders/dto/create-or-update-pickup.dto';

@Injectable()
export class PickupUpdaterService {
  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly permissionService: RepairOrderStatusPermissionsService,
    private readonly changeLogger: RepairOrderChangeLoggerService,
  ) {}

  async create(
    orderId: string,
    pickup: CreateOrUpdatePickupDto,
    adminId: string,
  ): Promise<RepairOrderPickup | undefined> {
    if (!pickup) return;

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
      'can_delivery_manage',
      'pickup',
    );

    if (pickup?.courier_id) {
      const courier = await this.knex('admins')
        .where({ id: pickup.courier_id, is_active: true, status: 'Open' })
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
      courier_id: pickup?.courier_id,
      repair_order_id: orderId,
      lat: pickup.lat,
      long: pickup.long,
      description: pickup.description,
      created_by: adminId,
      created_at: now,
      updated_at: now,
    };

    const [result]: RepairOrderPickup[] = await this.knex('repair_order_pickups')
      .insert(row)
      .returning('*');

    await this.changeLogger.logIfChanged(this.knex, orderId, 'pickup', null, result, adminId);

    return result;
  }

  async update(
    orderId: string,
    pickup: any,
    adminId: string,
  ): Promise<{ message: string } | undefined> {
    if (!pickup) return;

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
      'can_delivery_manage',
      'pickup',
    );

    if (pickup?.courier_id) {
      const courier = await this.knex('admins')
        .where({ id: pickup.courier_id, is_active: true, status: 'Open' })
        .first();
      if (!courier) {
        throw new BadRequestException({
          message: 'Courier not found or inactive',
          location: 'courier_id',
        });
      }
    }

    const old = await this.knex('repair_order_pickups').where({ repair_order_id: orderId }).first();
    if (!old) return;

    await this.knex('repair_order_pickups').where({ repair_order_id: orderId }).delete();

    const now = new Date();
    const row = {
      courier_id: pickup?.courier_id,
      repair_order_id: orderId,
      lat: pickup.lat,
      long: pickup.long,
      description: pickup.description,
      created_by: adminId,
      created_at: now,
      updated_at: now,
    };

    await this.knex('repair_order_pickups').insert(row);
    await this.changeLogger.logIfChanged(this.knex, orderId, 'pickup', old, row, adminId);
    return { message: '✅ Pickup updated' };
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
      'can_delivery_manage',
      'pickup',
    );

    const old = await this.knex('repair_order_pickups').where({ repair_order_id: orderId }).first();

    if (!old) return;

    await this.knex('repair_order_pickups').where({ repair_order_id: orderId }).delete();

    await this.changeLogger.logIfChanged(this.knex, orderId, 'pickup', old, null, adminId);

    return { message: '🗑️ Pickup deleted' };
  }
}
