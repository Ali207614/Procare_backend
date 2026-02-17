import { BadRequestException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import { getNextSortValue } from 'src/common/utils/sort.util';
import { RepairOrderStatusPermissionsService } from 'src/repair-order-status-permission/repair-order-status-permissions.service';
import { RedisService } from 'src/common/redis/redis.service';
import { loadSQL } from 'src/common/utils/sql-loader.util';
import {
  RepairOrder,
  RepairOrderDetails,
  FreshRepairOrder,
} from 'src/common/types/repair-order.interface';
import { RepairOrderStatusPermission } from 'src/common/types/repair-order-status-permssion.interface';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { RepairOrderChangeLoggerService } from 'src/repair-orders/services/repair-order-change-logger.service';
import { InitialProblemUpdaterService } from 'src/repair-orders/services/initial-problem-updater.service';
import { FinalProblemUpdaterService } from 'src/repair-orders/services/final-problem-updater.service';
import { RepairOrderCreateHelperService } from 'src/repair-orders/services/repair-order-create-helper.service';
import { LoggerService } from 'src/common/logger/logger.service';
import { CreateRepairOrderDto } from 'src/repair-orders/dto/create-repair-order.dto';
import { UpdateRepairOrderDto } from 'src/repair-orders/dto/update-repair-order.dto';
import { MoveRepairOrderDto } from 'src/repair-orders/dto/move-repair-order.dto';
import { FindAllRepairOrdersQueryDto } from 'src/repair-orders/dto/find-all-repair-orders.dto';
import { UpdateClientInfoDto, UpdateProductDto, UpdateProblemDto, TransferBranchDto } from './dto';
import { v4 as uuidv4 } from 'uuid';
import { ForbiddenException } from '@nestjs/common';

@Injectable()
export class RepairOrdersService {
  private readonly table = 'repair_orders';

  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly permissionService: RepairOrderStatusPermissionsService,
    private readonly changeLogger: RepairOrderChangeLoggerService,
    private readonly initialProblemUpdater: InitialProblemUpdaterService,
    private readonly finalProblemUpdater: FinalProblemUpdaterService,
    private readonly helper: RepairOrderCreateHelperService,
    private readonly redisService: RedisService,
    private readonly logger: LoggerService,
  ) {}

  async create(
    admin: AdminPayload,
    branchId: string,
    statusId: string,
    dto: CreateRepairOrderDto,
  ): Promise<RepairOrder> {
    const trx = await this.knex.transaction();
    try {
      const permissions: RepairOrderStatusPermission[] =
        await this.permissionService.findByRolesAndBranch(admin.roles, branchId);
      await this.permissionService.checkPermissionsOrThrow(
        admin.roles,
        branchId,
        statusId,
        ['can_add'],
        'repair_order_permission',
        permissions,
      );

      // ── Resolve user: either by user_id or by inline client info ──
      const currentStatusPermission = permissions.find((p) => p.status_id === statusId);
      let resolvedUserId: string | undefined = dto.user_id;
      let resolvedPhoneNumber = '';
      let resolvedName: string | null = null;

      if (dto.user_id) {
        // Flow 1: existing user_id provided
        const user = await trx('users').where({ id: dto.user_id, status: 'Open' }).first();
        if (!user)
          throw new BadRequestException({
            message: 'User not found or inactive',
            location: 'user_id',
          });
        resolvedPhoneNumber = user.phone_number1 || '';
        resolvedName = [user.first_name, user.last_name].filter(Boolean).join(' ') || null;
      } else if (dto.phone) {
        // Flow 2: inline client info (first_name, last_name, phone)
        const existingUser = await trx('users')
          .whereRaw('LOWER(phone_number1) = ?', dto.phone.toLowerCase())
          .andWhereNot({ status: 'Deleted' })
          .first();

        if (existingUser) {
          resolvedUserId = existingUser.id;
        } else if (currentStatusPermission?.can_create_user) {
          const [newUser] = await trx('users')
            .insert({
              first_name: dto.first_name || '',
              last_name: dto.last_name || '',
              phone_number1: dto.phone,
              is_active: true,
              source: 'employee',
              created_by: admin.id,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              status: 'Open',
            })
            .returning('*');
          resolvedUserId = newUser.id;
        }
        resolvedPhoneNumber = dto.phone;
        resolvedName = [dto.first_name, dto.last_name].filter(Boolean).join(' ') || null;
      } else {
        throw new BadRequestException({
          message: 'Either user_id or phone must be provided',
          location: 'user_id',
        });
      }

      const phoneCategory = await trx('phone_categories as pc')
        .select(
          'pc.*',
          this.knex.raw(
            `EXISTS (SELECT 1 FROM phone_categories c WHERE c.parent_id = pc.id AND c.status = 'Open') as has_children`,
          ),
        )
        .where({ 'pc.id': dto.phone_category_id, 'pc.is_active': true, 'pc.status': 'Open' })
        .first();
      if (!phoneCategory)
        throw new BadRequestException({
          message: 'Phone category not found or inactive',
          location: 'phone_category_id',
        });
      if (phoneCategory.has_children)
        throw new BadRequestException({
          message: 'Phone category must not have children',
          location: 'phone_category_id',
        });

      const sort = await getNextSortValue(trx, this.table, { where: { branch_id: branchId } });
      const insertData: Partial<RepairOrder> = {
        user_id: resolvedUserId,
        branch_id: branchId,
        phone_category_id: dto.phone_category_id,
        priority: dto.priority || 'Medium',
        status_id: statusId,
        sort,
        delivery_method: 'Self',
        pickup_method: 'Self',
        created_by: admin.id,
        phone_number: resolvedPhoneNumber,
        name: resolvedName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const [order]: RepairOrder[] = await trx(this.table).insert(insertData).returning('*');
      await Promise.all([
        this.helper.insertAssignAdmins(trx, dto, admin, statusId, order.id, branchId, permissions),
        this.helper.insertRentalPhone(trx, dto, admin, statusId, order.id, branchId, permissions),
        this.helper.insertInitialProblems(
          trx,
          dto,
          admin,
          statusId,
          order.id,
          branchId,
          permissions,
        ),
        this.helper.insertFinalProblems(trx, dto, admin, statusId, order.id, branchId, permissions),
        this.helper.insertComments(trx, dto, admin, statusId, order.id, branchId, permissions),
        this.helper.insertPickup(trx, dto, admin, statusId, order.id, branchId, permissions),
        this.helper.insertDelivery(trx, dto, admin, statusId, order.id, branchId, permissions),
      ]);

      await trx.commit();
      await this.redisService.flushByPrefix(`${this.table}:${branchId}`);
      return order;
    } catch (err) {
      await trx.rollback();

      if (err instanceof HttpException) {
        throw err;
      }
      this.logger.error(`Failed to create repair order:`);
      throw err;
    }
  }

  async update(
    admin: AdminPayload,
    orderId: string,
    dto: UpdateRepairOrderDto,
  ): Promise<{ message: string }> {
    const trx = await this.knex.transaction();
    try {
      const order: RepairOrder | undefined = await trx(this.table)
        .where({ id: orderId, status: 'Open' })
        .first();
      if (!order)
        throw new NotFoundException({ message: 'Order not found', location: 'repair_order' });

      const permissions: RepairOrderStatusPermission[] =
        await this.permissionService.findByRolesAndBranch(admin.roles, order.branch_id);
      await this.permissionService.checkPermissionsOrThrow(
        admin.roles,
        order.branch_id,
        order.status_id,
        ['can_update'],
        'repair_order_update',
        permissions,
      );

      const logFields: { key: string; oldVal: unknown; newVal: unknown }[] = [];
      const updatedFields: Partial<RepairOrder> = {};

      const fieldsToCheck: (keyof RepairOrder)[] = [
        'user_id',
        'status_id',
        'priority',
        'phone_category_id',
      ];
      for (const field of fieldsToCheck) {
        const dtoFieldValue = dto[field as keyof UpdateRepairOrderDto];
        if (dtoFieldValue !== undefined && dtoFieldValue !== order[field]) {
          (updatedFields as Record<string, unknown>)[field] = dtoFieldValue;
          logFields.push({ key: field, oldVal: order[field], newVal: dtoFieldValue });
        }
      }

      if (dto.user_id) {
        await this.permissionService.checkPermissionsOrThrow(
          admin.roles,
          order.branch_id,
          order.status_id,
          ['can_user_manage'],
          'repair_order_user_manage',
          permissions,
        );
        const user = await trx('users').where({ id: dto.user_id, status: 'Open' }).first();
        if (!user)
          throw new BadRequestException({ message: 'User not found', location: 'user_id' });
      }

      if (dto.phone_category_id) {
        const phoneCategory = await trx('phone_categories as pc')
          .select(
            'pc.*',
            this.knex.raw(
              `EXISTS (SELECT 1 FROM phone_categories c WHERE c.parent_id = pc.id AND c.status = 'Open') as has_children`,
            ),
          )
          .where({ 'pc.id': dto.phone_category_id, 'pc.is_active': true, 'pc.status': 'Open' })
          .first();
        if (!phoneCategory)
          throw new BadRequestException({
            message: 'Phone category not found or inactive',
            location: 'phone_category_id',
          });
        if (phoneCategory.has_children)
          throw new BadRequestException({
            message: 'Phone category must not have children',
            location: 'phone_category_id',
          });
      }

      if (Object.keys(updatedFields).length) {
        await trx(this.table)
          .where({ id: orderId })
          .update({ ...updatedFields, updated_at: new Date() });
      }

      await Promise.all([
        this.changeLogger.logMultipleFieldsIfChanged(trx, orderId, logFields, admin.id),
        this.initialProblemUpdater.update(trx, orderId, dto.initial_problems || [], admin),
        this.finalProblemUpdater.update(trx, orderId, dto.final_problems || [], admin),
      ]);

      await trx.commit();
      await this.redisService.flushByPrefix(`${this.table}:${order.branch_id}`);
      return { message: 'Repair order updated successfully' };
    } catch (err) {
      await trx.rollback();
      this.logger.error(`Failed to update repair order ${orderId}`);
      throw err;
    }
  }

  async findAllByAdminBranch(
    admin: AdminPayload,
    branchId: string,
    query: FindAllRepairOrdersQueryDto,
  ): Promise<Record<string, FreshRepairOrder[]>> {
    const {
      offset,
      limit,
      sort_by = 'sort',
      sort_order = 'asc',
      // Filters
      source_types,
      priorities,
      customer_name,
      phone_number,
      device_model,
      order_number,
      delivery_methods,
      pickup_methods,
      assigned_admin_ids,
      date_from,
      date_to,
    } = query;

    const permissions: RepairOrderStatusPermission[] =
      await this.permissionService.findByRolesAndBranch(admin.roles, branchId);

    const statusIds: string[] = permissions.filter((p) => p.can_view).map((p) => p.status_id);

    if (!statusIds.length) {
      return {};
    }

    // Build filter hash for cache key
    const filterHash = JSON.stringify({
      source_types,
      priorities,
      customer_name,
      phone_number,
      device_model,
      order_number,
      delivery_methods,
      pickup_methods,
      assigned_admin_ids,
      date_from,
      date_to,
    });

    const cacheKey = `${this.table}:${branchId}:${admin.id}:${sort_by}:${sort_order}:${offset}:${limit}:${Buffer.from(filterHash).toString('base64')}`;
    const cached: Record<string, FreshRepairOrder[]> | null = await this.redisService.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Build dynamic WHERE conditions
    const whereConditions: string[] = [];
    const queryParams: Record<string, unknown> = { branchId, statusIds, limit, offset };

    // Filter by source types (assuming we add source_type field)
    if (source_types?.length) {
      whereConditions.push(`ro.source_type = ANY(:sourceTypes)`);
      queryParams.sourceTypes = source_types;
    }

    // Filter by priorities
    if (priorities?.length) {
      whereConditions.push(`ro.priority = ANY(:priorities)`);
      queryParams.priorities = priorities;
    }

    // Filter by customer name
    if (customer_name) {
      whereConditions.push(
        `(LOWER(u.first_name || ' ' || u.last_name) LIKE LOWER(:customerName) OR LOWER(u.first_name) LIKE LOWER(:customerName) OR LOWER(u.last_name) LIKE LOWER(:customerName))`,
      );
      queryParams.customerName = `%${customer_name}%`;
    }

    // Filter by phone number
    if (phone_number) {
      whereConditions.push(
        `(u.phone_number1 LIKE :phoneNumber OR u.phone_number2 LIKE :phoneNumber)`,
      );
      queryParams.phoneNumber = `%${phone_number}%`;
    }

    // Filter by device model
    if (device_model) {
      whereConditions.push(
        `LOWER(pc.name_uz) LIKE LOWER(:deviceModel) OR LOWER(pc.name_ru) LIKE LOWER(:deviceModel) OR LOWER(pc.name_en) LIKE LOWER(:deviceModel)`,
      );
      queryParams.deviceModel = `%${device_model}%`;
    }

    // Filter by order number
    if (order_number) {
      whereConditions.push(`ro.number_id::text LIKE :orderNumber`);
      queryParams.orderNumber = `%${order_number}%`;
    }

    // Filter by delivery methods
    if (delivery_methods?.length) {
      whereConditions.push(`ro.delivery_method = ANY(:deliveryMethods)`);
      queryParams.deliveryMethods = delivery_methods;
    }

    // Filter by pickup methods
    if (pickup_methods?.length) {
      whereConditions.push(`ro.pickup_method = ANY(:pickupMethods)`);
      queryParams.pickupMethods = pickup_methods;
    }

    // Filter by assigned admin IDs
    if (assigned_admin_ids?.length) {
      whereConditions.push(
        `EXISTS (SELECT 1 FROM repair_order_assign_admins aa WHERE aa.repair_order_id = ro.id AND aa.admin_id = ANY(:assignedAdminIds))`,
      );
      queryParams.assignedAdminIds = assigned_admin_ids;
    }

    // Filter by date range
    if (date_from) {
      whereConditions.push(`ro.created_at >= :dateFrom`);
      queryParams.dateFrom = date_from;
    }

    if (date_to) {
      whereConditions.push(`ro.created_at <= :dateTo`);
      queryParams.dateTo = date_to;
    }

    const orderClause = `ORDER BY ro.status_id, ro.${sort_by} ${sort_order.toUpperCase()}`;

    let querySql = loadSQL('repair-orders/queries/find-all-by-admin-branch.sql').replace(
      '/*ORDER_CLAUSE*/',
      orderClause,
    );

    // Add dynamic filters to the WHERE clause
    if (whereConditions.length > 0) {
      const additionalWhere = whereConditions.join(' AND ');
      querySql = querySql.replace(
        'AND ro.status_id = ANY(:statusIds)',
        `AND ro.status_id = ANY(:statusIds) AND ${additionalWhere}`,
      );
    }

    try {
      console.log('Executing SQL:', querySql);
      const freshOrders: FreshRepairOrder[] = await this.knex
        .raw(querySql, queryParams)
        .then((r) => r.rows as FreshRepairOrder[]);

      const result: Record<string, FreshRepairOrder[]> = {};
      for (const statusId of statusIds) {
        result[statusId] = freshOrders.filter(
          (o: FreshRepairOrder) => o.repair_order_status.id === statusId,
        );
      }

      await this.redisService.set(cacheKey, result, 1800);

      return result;
    } catch (error) {
      this.logger.error(`Failed to get all repair orders:`, (error as Error)?.stack);
      if (error instanceof HttpException) throw error;
      throw error;
    }
  }

  async softDelete(admin: AdminPayload, orderId: string): Promise<{ message: string }> {
    const trx = await this.knex.transaction();
    try {
      const order: RepairOrder | undefined = await trx(this.table)
        .where({ id: orderId, status: 'Open' })
        .first();
      if (!order)
        throw new NotFoundException({
          message: 'Repair order not found or already deleted',
          location: 'repair_order',
        });

      const permissions: RepairOrderStatusPermission[] =
        await this.permissionService.findByRolesAndBranch(admin.roles, order.branch_id);
      await this.permissionService.checkPermissionsOrThrow(
        admin.roles,
        order.branch_id,
        order.status_id,
        ['can_delete'],
        'repair_order_delete',
        permissions,
      );

      await this.changeLogger.logIfChanged(
        trx,
        orderId,
        'status',
        order.status,
        'Deleted',
        admin.id,
      );
      await trx(this.table)
        .where({ id: orderId })
        .update({ status: 'Deleted', updated_at: new Date() });

      await trx.commit();
      await this.redisService.flushByPrefix(`${this.table}:${order.branch_id}`);
      return { message: 'Repair order deleted successfully' };
    } catch (err) {
      await trx.rollback();
      this.logger.error(`Failed to soft delete repair order ${orderId}`);
      throw err;
    }
  }

  async findById(admin: AdminPayload, orderId: string): Promise<RepairOrderDetails> {
    try {
      const query = loadSQL('repair-orders/queries/find-by-id.sql');
      const result: { rows: RepairOrderDetails[] } = await this.knex.raw(query, { orderId });
      const order: RepairOrderDetails = result.rows[0];

      if (!order)
        throw new NotFoundException({ message: 'Order not found', location: 'repair_order' });

      const permissions: RepairOrderStatusPermission[] =
        await this.permissionService.findByRolesAndBranch(admin.roles, order.branch.id);
      await this.permissionService.checkPermissionsOrThrow(
        admin.roles,
        order.branch.id,
        order.repair_order_status.id,
        ['can_view'],
        'repair_order_view',
        permissions,
      );

      return order;
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }
      this.logger.error(`Failed to get one repair order:`);
      throw err;
    }
  }

  async sendStatusChangeNotification(
    trx: Knex.Transaction,
    orderId: string,
    newStatusId: string,
    changedByAdminId: string,
  ): Promise<void> {
    const order = await trx('repair_orders').where({ id: orderId }).first();
    if (!order) return;

    const permissionedAdmins: RepairOrderStatusPermission[] = await trx(
      'repair_order_status_permissions',
    )
      .select('role_id')
      .where({ status_id: newStatusId, branch_id: order.branch_id, can_notification: true });

    if (!permissionedAdmins.length) return;

    const now = new Date();
    const notifications = permissionedAdmins.map((a) => ({
      role_id: a.role_id,
      title: 'Buyurtma holati o‘zgardi',
      message: `Buyurtma yangi statusga o'tdi`,
      type: 'info',
      meta: {
        order_id: order.id,
        from_status_id: order.status_id,
        to_status_id: newStatusId,
        changed_by: changedByAdminId,
        action: 'status_changed',
      },
      created_at: now,
      updated_at: now,
    }));

    await trx('notifications').insert(notifications);
  }

  async move(
    admin: AdminPayload,
    orderId: string,
    dto: MoveRepairOrderDto,
  ): Promise<{ message: string }> {
    const trx = await this.knex.transaction();
    try {
      const order: RepairOrder | undefined = await trx(this.table)
        .where({ id: orderId, status: 'Open' })
        .first();
      if (!order)
        throw new NotFoundException({ message: 'Order not found', location: 'repair_order' });

      if (dto.status_id !== order.status_id) {
        const transitionExists = await trx('repair-order-status-transitions')
          .where({ from_status_id: order.status_id, to_status_id: dto.status_id })
          .first();
        if (!transitionExists)
          throw new BadRequestException({
            message: 'Invalid status transition',
            location: 'status_id',
          });

        // await this.sendStatusChangeNotification(trx, orderId, dto.status_id, admin.id);
      }

      const permissions: RepairOrderStatusPermission[] =
        await this.permissionService.findByRolesAndBranch(admin.roles, order.branch_id);
      await this.permissionService.checkPermissionsOrThrow(
        admin.roles,
        order.branch_id,
        order.status_id,
        ['can_change_status'],
        'repair_order_change_status',
        permissions,
      );

      const updates: Partial<RepairOrder> = {};
      const logs: { key: string; oldVal: unknown; newVal: unknown }[] = [];

      // If the order has no linked user yet, check whether the target status
      // has can_create_user enabled and, if so, find-or-create the user.
      if (!order.user_id) {
        const targetPermission = permissions.find((p) => p.status_id === dto.status_id);

        if (targetPermission?.can_create_user) {
          const linkedUserId = await this.ensureUserLinked(trx, order, admin.id);

          if (linkedUserId) {
            updates.user_id = linkedUserId;
            logs.push({ key: 'user_id', oldVal: order.user_id, newVal: linkedUserId });
          }
        }
      }

      if (dto.status_id !== order.status_id) {
        updates.status_id = dto.status_id;
        logs.push({ key: 'status_id', oldVal: order.status_id, newVal: dto.status_id });
      }

      if (dto.sort !== undefined && dto.sort !== order.sort) {
        updates.sort = dto.sort;
        logs.push({ key: 'sort', oldVal: order.sort, newVal: dto.sort });
      }

      if (Object.keys(updates).length) {
        await trx(this.table)
          .where({ id: orderId })
          .update({ ...updates, updated_at: new Date() });
      }

      await this.changeLogger.logMultipleFieldsIfChanged(trx, orderId, logs, admin.id);
      await trx.commit();
      await this.redisService.flushByPrefix(`${this.table}:${order.branch_id}`);
      return { message: 'Repair order moved successfully' };
    } catch (err) {
      await trx.rollback();
      this.logger.error(`Failed to move repair order ${orderId}`);
      throw err;
    }
  }

  async updateSort(
    orderId: string,
    newSort: number,
    admin: AdminPayload,
  ): Promise<{ message: string }> {
    const trx = await this.knex.transaction();
    try {
      const order: RepairOrder | undefined = await trx(this.table)
        .where({ id: orderId, status: 'Open' })
        .first();
      if (!order)
        throw new NotFoundException({
          message: 'Repair order not found or already deleted',
          location: 'repair_order',
        });

      const permissions: RepairOrderStatusPermission[] =
        await this.permissionService.findByRolesAndBranch(admin.roles, order.branch_id);
      await this.permissionService.checkPermissionsOrThrow(
        admin.roles,
        order.branch_id,
        order.status_id,
        ['can_update'],
        'repair_order_update',
        permissions,
      );

      if (newSort === order.sort) return { message: 'No change needed' };

      if (newSort < order.sort) {
        await trx(this.table)
          .where({ branch_id: order.branch_id, status_id: order.status_id, status: 'Open' })
          .andWhere('sort', '>=', newSort)
          .andWhere('sort', '<', order.sort)
          .update({ sort: this.knex.raw('sort + 1') });
      } else {
        await trx(this.table)
          .where({ branch_id: order.branch_id, status_id: order.status_id, status: 'Open' })
          .andWhere('sort', '<=', newSort)
          .andWhere('sort', '>', order.sort)
          .update({ sort: this.knex.raw('sort - 1') });
      }

      await trx(this.table)
        .where({ id: orderId })
        .update({ sort: newSort, updated_at: new Date() });
      await this.changeLogger.logIfChanged(trx, orderId, 'sort', order.sort, newSort, admin.id);

      await trx.commit();
      await this.redisService.flushByPrefix(`${this.table}:${order.branch_id}`);
      return { message: 'Repair order sort updated successfully' };
    } catch (err) {
      await trx.rollback();
      this.logger.error(`Failed to update sort for repair order ${orderId}`);
      throw err;
    }
  }

  async updateClientInfo(
    repairOrderId: string,
    updateDto: UpdateClientInfoDto,
    admin: AdminPayload,
  ): Promise<{ message: string }> {
    const order: RepairOrder | undefined = await this.knex(this.table)
      .where({ id: repairOrderId, status: 'Open' })
      .first();
    if (!order) {
      throw new NotFoundException('Repair order not found');
    }

    const permissions = await this.permissionService.findByRolesAndBranch(
      admin.roles,
      order.branch_id,
    );
    await this.permissionService.checkPermissionsOrThrow(
      admin.roles,
      order.branch_id,
      order.status_id,
      ['can_update'],
      'repair_order_update',
      permissions,
    );

    const updateFields: Record<string, unknown> = {};

    // Map first_name + last_name → name (the actual column on repair_orders)
    if (updateDto.first_name !== undefined || updateDto.last_name !== undefined) {
      const nameParts = [updateDto.first_name, updateDto.last_name].filter(Boolean);
      if (nameParts.length > 0) {
        updateFields.name = nameParts.join(' ');
      }
    }

    // Map phone → phone_number (the actual column on repair_orders)
    if (updateDto.phone !== undefined) updateFields.phone_number = updateDto.phone;

    if (Object.keys(updateFields).length === 0) {
      throw new BadRequestException('No valid fields to update');
    }

    updateFields.updated_at = new Date();

    await this.knex(this.table).where({ id: repairOrderId }).update(updateFields);

    await this.changeLogger.logChange(repairOrderId, 'client_info_updated', updateDto, admin.id);
    await this.redisService.flushByPrefix(`${this.table}:${order.branch_id}`);

    return { message: 'Client info updated successfully' };
  }

  async updateProduct(
    repairOrderId: string,
    updateDto: UpdateProductDto,
    admin: AdminPayload,
  ): Promise<{ message: string }> {
    const order: RepairOrder | undefined = await this.knex(this.table)
      .where({ id: repairOrderId, status: 'Open' })
      .first();
    if (!order) {
      throw new NotFoundException('Repair order not found');
    }

    const permissions = await this.permissionService.findByRolesAndBranch(
      admin.roles,
      order.branch_id,
    );
    await this.permissionService.checkPermissionsOrThrow(
      admin.roles,
      order.branch_id,
      order.status_id,
      ['can_update'],
      'repair_order_update',
      permissions,
    );

    if (updateDto.phone_category_id) {
      const phoneCategory = await this.knex('phone_categories')
        .where({ id: updateDto.phone_category_id, status: 'Open' })
        .whereNull('parent_id')
        .first();

      if (!phoneCategory) {
        throw new BadRequestException('Invalid phone category');
      }
    }

    const updateFields: Record<string, unknown> = {};
    if (updateDto.phone_category_id !== undefined)
      updateFields.phone_category_id = updateDto.phone_category_id;
    if (updateDto.imei !== undefined) updateFields.imei = updateDto.imei;

    if (Object.keys(updateFields).length === 0) {
      throw new BadRequestException('No valid fields to update');
    }

    updateFields.updated_at = new Date();

    const updated = await this.knex(this.table)
      .where({ id: repairOrderId })
      .update(updateFields)
      .returning('*');

    await this.changeLogger.logChange(repairOrderId, 'product_updated', updateDto, admin.id);
    await this.redisService.flushByPrefix(`${this.table}:${order.branch_id}`);

    return updated[0] as { message: string };
  }

  async updateProblem(
    repairOrderId: string,
    problemId: string,
    updateDto: UpdateProblemDto,
    admin: AdminPayload,
  ): Promise<{ message: string }> {
    const order: RepairOrder | undefined = await this.knex(this.table)
      .where({ id: repairOrderId, status: 'Open' })
      .first();
    if (!order) {
      throw new NotFoundException('Repair order not found');
    }

    const trx = await this.knex.transaction();
    try {
      let problemType: 'initial' | 'final' | null = null;

      // 1. Identify if it's an initial or final problem
      let existingProblem = await trx('repair_order_initial_problems')
        .where({ id: problemId, repair_order_id: repairOrderId })
        .first();

      if (existingProblem) {
        problemType = 'initial';
      } else {
        existingProblem = await trx('repair_order_final_problems')
          .where({ id: problemId, repair_order_id: repairOrderId })
          .first();
        if (existingProblem) {
          problemType = 'final';
        }
      }

      if (!problemType) {
        await trx.rollback();
        throw new NotFoundException('Problem not found');
      }

      const permissions = await this.permissionService.findByRolesAndBranch(
        admin.roles,
        order.branch_id,
      );
      await this.permissionService.checkPermissionsOrThrow(
        admin.roles,
        order.branch_id,
        order.status_id,
        ['can_update'],
        'repair_order_update',
        permissions,
      );

      // 2. Update problem details
      const problemTableName =
        problemType === 'initial'
          ? 'repair_order_initial_problems'
          : 'repair_order_final_problems';

      const updateFields: Record<string, unknown> = {};
      if (updateDto.problem_category_id !== undefined)
        updateFields.problem_category_id = updateDto.problem_category_id;
      if (updateDto.price !== undefined) updateFields.price = updateDto.price;
      if (updateDto.estimated_minutes !== undefined)
        updateFields.estimated_minutes = updateDto.estimated_minutes;

      if (Object.keys(updateFields).length > 0) {
        updateFields.updated_at = new Date();
        await trx(problemTableName).where({ id: problemId }).update(updateFields);
      }

      // 3. Update parts
      if (updateDto.parts !== undefined) {
        const idColumn =
          problemType === 'initial'
            ? 'repair_order_initial_problem_id'
            : 'repair_order_final_problem_id';

        await trx('repair_order_parts').where({ [idColumn]: problemId }).del();

        if (updateDto.parts.length > 0) {
          const partsData = updateDto.parts.map((p) => ({
            repair_order_id: repairOrderId,
            [idColumn]: problemId,
            repair_part_id: p.id,
            part_price: p.part_price,
            quantity: p.quantity,
            created_by: admin.id,
            created_at: new Date(),
            updated_at: new Date(),
          }));

          await trx('repair_order_parts').insert(partsData);
        }
      }

      await trx.commit();
      await this.changeLogger.logChange(repairOrderId, 'problem_updated', updateDto, admin.id);
      await this.redisService.flushByPrefix(`${this.table}:${order.branch_id}`);

      return { message: 'Problem updated successfully' };
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  async transferBranch(
    repairOrderId: string,
    transferDto: TransferBranchDto,
    admin: AdminPayload,
  ): Promise<{ message: string }> {
    const order: RepairOrder | undefined = await this.knex(this.table)
      .where({ id: repairOrderId, status: 'Open' })
      .first();
    if (!order) {
      throw new NotFoundException('Repair order not found');
    }

    const currentPermissions = await this.permissionService.findByRolesAndBranch(
      admin.roles,
      order.branch_id,
    );
    await this.permissionService.checkPermissionsOrThrow(
      admin.roles,
      order.branch_id,
      order.status_id,
      ['can_update'],
      'repair_order_update',
      currentPermissions,
    );

    const newBranch = await this.knex('branches')
      .where({ id: transferDto.new_branch_id, status: 'Open' })
      .first();

    if (!newBranch) {
      throw new BadRequestException('Invalid or inactive branch');
    }

    const hasPermission = await this.knex('admin_branches')
      .where({
        admin_id: admin.id,
        branch_id: transferDto.new_branch_id,
      })
      .first();

    if (!hasPermission) {
      throw new ForbiddenException('No permission to transfer to this branch');
    }

    const trx = await this.knex.transaction();
    try {
      const updated = await trx(this.table)
        .where({ id: repairOrderId })
        .update({
          branch_id: transferDto.new_branch_id,
          updated_at: new Date(),
        })
        .returning('*');

      await this.changeLogger.logChange(
        repairOrderId,
        'branch_transferred',
        {
          old_branch_id: order.branch_id,
          new_branch_id: transferDto.new_branch_id,
        },
        admin.id,
      );

      await trx.commit();

      await this.redisService.flushByPrefix(`${this.table}:${order.branch_id}`);
      await this.redisService.flushByPrefix(`${this.table}:${transferDto.new_branch_id}`);

      return updated[0] as { message: string };
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  /**
   * Finds an existing user by the repair order's phone_number column,
   * or creates a new one using phone_number + name from the order.
   *
   * @returns The user ID to assign, or null if phone_number is missing.
   */
  private async ensureUserLinked(
    trx: Knex.Transaction,
    order: RepairOrder,
    adminId: string,
  ): Promise<string | null> {
    const phone = order.phone_number;
    if (!phone) return null;

    // Try to find an existing, non-deleted user with the same phone
    const existingUser: { id: string } | undefined = await trx('users')
      .whereRaw('LOWER(phone_number1) = ?', phone.toLowerCase())
      .andWhereNot({ status: 'Deleted' })
      .first();

    if (existingUser) {
      return existingUser.id;
    }

    // Split the single "name" column (e.g. "Asilbek Azimov") into first/last
    const fullName = (order.name || '').trim();
    const spaceIndex = fullName.indexOf(' ');
    const firstName = spaceIndex > -1 ? fullName.substring(0, spaceIndex) : fullName;
    const lastName = spaceIndex > -1 ? fullName.substring(spaceIndex + 1) : '';

    const [newUser]: { id: string }[] = await trx('users')
      .insert({
        first_name: firstName,
        last_name: lastName,
        phone_number1: phone,
        is_active: true,
        source: 'employee',
        created_by: adminId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'Open',
      })
      .returning('id');

    return newUser.id;
  }
}
