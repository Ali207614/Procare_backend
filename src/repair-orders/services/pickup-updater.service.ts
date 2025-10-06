import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import { RepairOrderStatusPermissionsService } from 'src/repair-order-status-permission/repair-order-status-permissions.service';
import { RepairOrderChangeLoggerService } from './repair-order-change-logger.service';
import { RepairOrder } from 'src/common/types/repair-order.interface';
import { RepairOrderPickup } from 'src/common/types/delivery-and-pickup.interface';
import { CreateOrUpdatePickupDto } from 'src/repair-orders/dto/create-or-update-pickup.dto';
import { RepairOrderStatusPermission } from 'src/common/types/repair-order-status-permssion.interface';
import { AdminPayload } from 'src/common/types/admin-payload.interface';

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
    admin: AdminPayload,
  ): Promise<RepairOrderPickup | undefined> {
    if (!pickup) return;

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

    if (pickup?.courier_id) {
      const courier = await this.knex('admins as a')
        .join('admin_branches as ab', 'a.id', 'ab.admin_id')
        .where({
          'a.id': pickup.courier_id,
          'a.is_active': true,
          'a.status': 'Open',
          'ab.branch_id': order.branch_id,
        })
        .first('a.*');
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
      created_by: admin.id,
      created_at: now,
      updated_at: now,
    };

    const [result]: RepairOrderPickup[] = await this.knex('repair_order_pickups')
      .insert(row)
      .returning('*');

    await this.changeLogger.logIfChanged(this.knex, orderId, 'pickup', null, result, admin.id);

    return result;
  }

  async update(
    pickupId: string,
    pickup: CreateOrUpdatePickupDto,
    admin: AdminPayload,
  ): Promise<{ message: string }> {
    const old: RepairOrderPickup | undefined = await this.knex<RepairOrderPickup>(
      'repair_order_pickups',
    )
      .where({ id: pickupId, status: 'Open' })
      .first();

    if (!old) {
      throw new BadRequestException({
        message: 'Pickup not found',
        location: 'pickup_id',
      });
    }

    const order: RepairOrder | undefined = await this.knex('repair_orders')
      .where({ id: old.repair_order_id })
      .first();

    if (!order) {
      throw new BadRequestException({
        message: 'Repair order not found',
        location: 'repair_order_id',
      });
    }

    const allPermissions = await this.permissionService.findByRolesAndBranch(
      admin.roles,
      order.branch_id,
    );
    await this.permissionService.checkPermissionsOrThrow(
      admin.roles,
      order.branch_id,
      order.status_id,
      ['can_pickup_manage'],
      'repair_order_pickup',
      allPermissions,
    );

    if (pickup?.courier_id) {
      const courier = await this.knex('admins as a')
        .join('admin_branches as ab', 'a.id', 'ab.admin_id')
        .where({
          'a.id': pickup.courier_id,
          'a.is_active': true,
          'a.status': 'Open',
          'ab.branch_id': order.branch_id,
        })
        .first('a.*');

      if (!courier) {
        throw new BadRequestException({
          message: 'Courier not found or inactive',
          location: 'courier_id',
        });
      }
    }

    const now = new Date();
    const updatedRow = {
      courier_id: pickup?.courier_id ?? old.courier_id,
      lat: pickup.lat ?? old.lat,
      long: pickup.long ?? old.long,
      description: pickup.description ?? old.description,
      updated_at: now,
      updated_by: admin.id,
    };

    await this.knex('repair_order_pickups').where({ id: pickupId }).update(updatedRow);

    await this.changeLogger.logIfChanged(
      this.knex,
      old.repair_order_id,
      'pickup',
      old,
      updatedRow,
      admin.id,
    );

    return { message: '✅ Pickup updated' };
  }

  async delete(pickupId: string, admin: AdminPayload): Promise<{ message: string }> {
    const old: RepairOrderPickup | undefined = await this.knex<RepairOrderPickup>(
      'repair_order_pickups',
    )
      .where({ id: pickupId, status: 'Open' })
      .first();

    if (!old) {
      throw new BadRequestException({
        message: 'Pickup not found',
        location: 'pickup_id',
      });
    }

    const order: RepairOrder | undefined = await this.knex('repair_orders')
      .where({ id: old.repair_order_id })
      .first();

    if (!order) {
      throw new BadRequestException({
        message: 'Repair order not found',
        location: 'repair_order_id',
      });
    }

    const allPermissions = await this.permissionService.findByRolesAndBranch(
      admin.roles,
      order.branch_id,
    );
    await this.permissionService.checkPermissionsOrThrow(
      admin.roles,
      order.branch_id,
      order.status_id,
      ['can_pickup_manage'],
      'repair_order_pickup',
      allPermissions,
    );

    await this.knex('repair_order_pickups').where({ id: pickupId, status: 'Open' }).update({
      status: 'Deleted',
      updated_at: this.knex.fn.now(),
      updated_by: admin.id,
    });

    await this.changeLogger.logIfChanged(
      this.knex,
      old.repair_order_id,
      'pickup',
      old,
      null,
      admin.id,
    );

    return { message: '🗑️ Pickup deleted' };
  }
}
