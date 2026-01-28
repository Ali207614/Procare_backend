import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import type { Knex } from 'knex';
import { NotificationService } from 'src/notification/notification.service';
import { RepairOrderStatusPermissionsService } from 'src/repair-order-status-permission/repair-order-status-permissions.service';
import { CreateRepairOrderDto } from '../dto/create-repair-order.dto';
import { validateAndInsertProblems } from 'src/common/utils/problem.util';
import { RedisService } from 'src/common/redis/redis.service';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { RepairOrderStatusPermission } from 'src/common/types/repair-order-status-permssion.interface';
import { User } from 'src/common/types/user.interface';
import { RentalPhone } from 'src/common/types/rental-phone.interface';
import { LoggerService } from 'src/common/logger/logger.service';

@Injectable()
export class RepairOrderCreateHelperService {
  private readonly redisKeyRentalPhoneDevice = 'rental_phone:';
  private readonly redisKeyUser = 'user:';
  private readonly redisKeyAdmin = 'admin:';

  constructor(
    private readonly permissionService: RepairOrderStatusPermissionsService,
    private readonly notificationService: NotificationService,
    private readonly redisService: RedisService,
    private readonly logger: LoggerService,
  ) {}

  async flushCacheByPrefix(prefix: string, id?: string): Promise<void> {
    try {
      if (id) {
        await this.redisService.del(`${prefix}${id}`);
        this.logger.debug(`Flushed cache for ${prefix}${id}`);
      } else {
        await this.redisService.flushByPrefix(prefix);
        this.logger.debug(`Flushed cache for prefix ${prefix}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error while flushing cache';

      this.logger.error(`Failed to flush cache for prefix ${prefix}: ${message}`);

      throw new InternalServerErrorException({
        message,
        location: 'flush_cache',
      });
    }
  }

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

    try {
      this.logger.log(`Inserting rental phone for repair order ${orderId}`);
      await this.permissionService.checkPermissionsOrThrow(
        admin.roles,
        branchId,
        statusId,
        ['can_manage_rental_phone'],
        'repair_order_rental_phones',
        allPermissions,
      );

      const phone = dto.rental_phone;
      const cacheKey = `${this.redisKeyRentalPhoneDevice}${phone.rental_phone_id}`;
      let device: RentalPhone | null = await this.redisService.get(cacheKey);

      if (!device) {
        device = await trx('rental_phone_devices')
          .where({ id: phone.rental_phone_id, status: 'Available', is_active: true })
          .first();
        if (device) await this.redisService.set(cacheKey, device, 3600);
      }

      if (!device) {
        throw new BadRequestException({
          message: 'Rental phone not found or unavailable',
          location: 'rental_phone.rental_phone_id',
        });
      }

      if (phone.price && !phone.currency) {
        throw new BadRequestException({
          message: 'Currency is required when price is provided',
          location: 'rental_phone.currency',
        });
      }

      const [inserted] = await trx('repair_order_rental_phones')
        .insert({
          repair_order_id: orderId,
          rental_phone_id: phone.rental_phone_id,
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
        .where({ id: phone.rental_phone_id })
        .update({ status: 'Rented', updated_at: new Date() });

      const userCacheKey = `${this.redisKeyUser}${dto.user_id}`;
      let user: User | null | undefined = await this.redisService.get(userCacheKey);
      if (!user) {
        user = await trx<User>('users').where({ id: dto.user_id, status: 'Open' }).first();
        if (user) await this.redisService.set(userCacheKey, user, 3600);
      }

      // External system integration removed

      this.logger.log(`Inserted rental phone for repair order ${orderId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to insert rental phone';

      this.logger.error(`Failed to insert rental phone for repair order ${orderId}: ${message}`);

      throw new BadRequestException({
        message,
        location: 'insert_rental_phone',
      });
    }
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

    try {
      this.logger.log(`Assigning admins to repair order ${orderId}`);
      await this.permissionService.checkPermissionsOrThrow(
        admin.roles,
        branchId,
        statusId,
        ['can_assign_admin'],
        'repair_order_assign_admins',
        allPermissions,
      );

      const uniqueIds = [...new Set(dto.admin_ids)];

      const existingAdmins: string[] = await trx('admin_branches as ab')
        .join('branches as b', 'ab.branch_id', 'b.id')
        .whereIn('ab.admin_id', uniqueIds)
        .andWhere('ab.branch_id', branchId)
        .andWhere('b.status', 'Open')
        .pluck('ab.admin_id');

      const notFound = uniqueIds.filter((id: string): boolean => !existingAdmins?.includes(id));
      if (notFound.length) {
        throw new BadRequestException({
          message: 'Admin(s) not found or not in specified branch',
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
            assigned_by: admin.id,
            action: 'assigned_to_order',
          },
          created_at: now,
          updated_at: now,
        }));

        await trx('notifications').insert(notifications);
        try {
          await this.notificationService.notifyAdmins(trx, uniqueIds, {
            title: 'Yangi buyurtma',
            message: 'Sizga yangi buyurtma biriktirildi.',
            meta: {
              order_id: order.id,
              action: 'assigned_to_order',
            },
          });
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Unknown error while sending notifications';

          this.logger.error(`Failed to send notifications for repair order ${orderId}: ${message}`);

          throw new BadRequestException({
            message: 'Failed to send notifications',
            location: 'notifications',
          });
        }
      }

      this.logger.log(`Assigned ${uniqueIds.length} admins to repair order ${orderId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to assign admins';

      this.logger.error(`Failed to assign admins to repair order  ${orderId}: ${message}`);

      throw new BadRequestException({
        message,
        location: 'insert_assign_admins',
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
    try {
      this.logger.log(`Inserting initial problems for repair order ${orderId}`);
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
      this.logger.log(`Inserted initial problems for repair order ${orderId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to insert initial problems';

      this.logger.error(
        `Failed to insert initial problems for repair order ${orderId}: ${message}`,
      );

      throw new BadRequestException({
        message,
        location: 'insert_initial_problems',
      });
    }
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
    try {
      this.logger.log(`Inserting final problems for repair order ${orderId}`);
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
      this.logger.log(`Inserted final problems for repair order ${orderId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to insert final problems';

      this.logger.error(`Failed to final  problems for repair order ${orderId}: ${message}`);

      throw new BadRequestException({
        message,
        location: 'insert_final_problems',
      });
    }
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

    try {
      this.logger.log(`Inserting comments for repair order ${orderId}`);
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
      this.logger.log(`Inserted ${dto.comments.length} comments for repair order ${orderId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to insert insert_comments';

      this.logger.error(`Failed to final insert_comments for repair order ${orderId}: ${message}`);

      throw new BadRequestException({
        message,
        location: 'insert_comments',
      });
    }
  }

  /**
   * Inserts pickup details for a repair order.
   */
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

    try {
      if (dto.pickup.courier_id) {
        const courierCacheKey = `${this.redisKeyAdmin}${dto.pickup.courier_id}`;
        let courier = await this.redisService.get(courierCacheKey);
        if (!courier) {
          courier = await trx('admins as a')
            .join('admin_branches as ab', 'a.id', 'ab.admin_id')
            .where({
              'a.id': dto.pickup.courier_id,
              'a.is_active': true,
              'a.status': 'Open',
              'ab.branch_id': branchId,
            })
            .first('a.*');
          if (courier) await this.redisService.set(courierCacheKey, courier, 3600);
        }

        if (!courier) {
          throw new BadRequestException({
            message: 'Courier not found, inactive, or not in specified branch',
            location: 'pickup.courier_id',
          });
        }
      }

      await this.permissionService.checkPermissionsOrThrow(
        admin.roles,
        branchId,
        statusId,
        ['can_pickup_manage'],
        'repair_order_pickups',
        allPermissions,
      );

      await trx('repair_order_pickups').insert({
        repair_order_id: orderId,
        ...dto.pickup,
        created_by: admin.id,
        created_at: new Date(),
        updated_at: new Date(),
      });
      this.logger.log(`Inserted pickup details for repair order ${orderId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to insert pickup details';

      this.logger.error(`Failed to insert pickup for repair order ${orderId}: ${message}`);

      throw new BadRequestException({
        message,
        location: 'insert_pickup',
      });
    }
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

    try {
      this.logger.log(`Inserting delivery details for repair order ${orderId}`);
      if (dto.delivery.courier_id) {
        const courierCacheKey = `${this.redisKeyAdmin}${dto.delivery.courier_id}`;
        let courier = await this.redisService.get(courierCacheKey);
        if (!courier) {
          courier = await trx('admins as a')
            .join('admin_branches as ab', 'a.id', 'ab.admin_id')
            .where({
              'a.id': dto.delivery.courier_id,
              'a.is_active': true,
              'a.status': 'Open',
              'ab.branch_id': branchId,
            })
            .first('a.*');
          if (courier) await this.redisService.set(courierCacheKey, courier, 3600);
        }

        if (!courier) {
          throw new BadRequestException({
            message: 'Courier not found, inactive, or not in specified branch',
            location: 'delivery.courier_id',
          });
        }
      }

      await this.permissionService.checkPermissionsOrThrow(
        admin.roles,
        branchId,
        statusId,
        ['can_delivery_manage'],
        'repair_order_deliveries',
        allPermissions,
      );

      await trx('repair_order_deliveries').insert({
        repair_order_id: orderId,
        ...dto.delivery,
        created_by: admin.id,
        created_at: new Date(),
        updated_at: new Date(),
      });
      this.logger.log(`Inserted delivery details for repair order ${orderId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to insert delivery details';

      this.logger.error(`Failed to insert delivery for repair order ${orderId}: ${message}`);

      throw new BadRequestException({
        message,
        location: 'insert_delivery',
      });
    }
  }
}
