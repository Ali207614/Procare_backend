import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RepairOrdersService } from '../../src/repair-orders/repair-orders.service';
import { RepairOrderStatusPermissionsService } from '../../src/repair-order-status-permission/repair-order-status-permissions.service';
import { RepairOrderChangeLoggerService } from '../../src/repair-orders/services/repair-order-change-logger.service';
import { InitialProblemUpdaterService } from '../../src/repair-orders/services/initial-problem-updater.service';
import { FinalProblemUpdaterService } from '../../src/repair-orders/services/final-problem-updater.service';
import { RepairOrderCreateHelperService } from '../../src/repair-orders/services/repair-order-create-helper.service';
import { RedisService } from '../../src/common/redis/redis.service';
import { LoggerService } from '../../src/common/logger/logger.service';
import { PdfService } from '../../src/pdf/pdf.service';
import { RepairOrderWebhookService } from '../../src/repair-orders/services/repair-order-webhook.service';
import { NotificationService } from '../../src/notification/notification.service';
import { RepairOrder } from '../../src/common/types/repair-order.interface';
import { RepairOrderStatusPermission } from '../../src/common/types/repair-order-status-permssion.interface';
import { AdminPayload } from '../../src/common/types/admin-payload.interface';

type Mocked<T> = {
  [K in keyof T]: jest.Mock;
};

function createQueryBuilder(result: unknown) {
  return {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    whereNotIn: jest.fn().mockReturnThis(),
    whereNot: jest.fn().mockReturnThis(),
    andWhereNot: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(result),
    update: jest.fn().mockResolvedValue(1),
    decrement: jest.fn().mockResolvedValue(1),
    increment: jest.fn().mockResolvedValue(1),
    select: jest.fn().mockReturnThis(),
    join: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([result]),
  };
}

function createTransactionMock(resolvers: Record<string, unknown | unknown[]>) {
  const trx = ((table: string) => {
    const value = resolvers[table];
    const nextValue = Array.isArray(value) ? value.shift() : value;
    return createQueryBuilder(nextValue);
  }) as jest.MockedFunction<any> & {
    commit: jest.Mock;
    rollback: jest.Mock;
  };

  trx.commit = jest.fn().mockResolvedValue(undefined);
  trx.rollback = jest.fn().mockResolvedValue(undefined);

  return trx;
}

describe('RepairOrdersService transition hardening', () => {
  let service: RepairOrdersService;
  let knex: { transaction: jest.Mock; raw: jest.Mock };
  let permissionService: Mocked<RepairOrderStatusPermissionsService>;
  let changeLogger: Mocked<RepairOrderChangeLoggerService>;
  let initialProblemUpdater: Mocked<InitialProblemUpdaterService>;
  let finalProblemUpdater: Mocked<FinalProblemUpdaterService>;
  let helper: Mocked<RepairOrderCreateHelperService>;
  let redisService: Mocked<RedisService>;
  let logger: Mocked<LoggerService>;
  let pdfService: Mocked<PdfService>;
  let webhookService: Mocked<RepairOrderWebhookService>;
  let notificationService: Mocked<NotificationService>;

  const admin: AdminPayload = {
    id: 'admin-id',
    phone_number: '+998900000000',
    roles: [
      { id: 'primary-role', name: 'Primary' },
      { id: 'secondary-role', name: 'Secondary' },
    ],
  };

  const order: RepairOrder = {
    id: 'order-id',
    number_id: 12,
    branch_id: 'branch-id',
    user_id: 'user-id',
    total: '0',
    delivery_method: 'Self',
    pickup_method: 'Self',
    status_id: 'status-old',
    status: 'Open',
    sort: 2,
    agreed_date: null,
    imei: null,
    reject_cause_id: null,
    region_id: null,
    phone_number: '+998900000001',
    priority: 'Medium',
    priority_level: 2,
    phone_category_id: 'phone-category-id',
    call_count: 0,
    missed_calls: 0,
    name: 'Test User',
    description: null,
    source: null,
    created_by: admin.id,
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  const currentStatusPermission = {
    id: 'perm-current',
    branch_id: 'branch-id',
    status_id: 'status-old',
    role_id: 'primary-role',
    can_add: true,
    can_view: true,
    can_update: true,
    can_delete: true,
    can_payment_add: true,
    can_payment_cancel: true,
    can_assign_admin: true,
    can_notification: true,
    can_notification_bot: true,
    can_change_active: true,
    can_change_status: true,
    can_view_initial_problems: true,
    can_change_initial_problems: true,
    can_view_final_problems: true,
    can_change_final_problems: true,
    can_comment: true,
    can_pickup_manage: true,
    can_delivery_manage: true,
    can_view_payments: true,
    can_manage_rental_phone: true,
    can_view_history: true,
    can_user_manage: true,
    can_create_user: false,
    cannot_continue_without_imei: false,
    cannot_continue_without_reject_cause: false,
    cannot_continue_without_agreed_date: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } satisfies RepairOrderStatusPermission;

  const secondaryRoleTargetPermission = {
    ...currentStatusPermission,
    id: 'perm-secondary-target',
    role_id: 'secondary-role',
    status_id: 'status-new',
    cannot_continue_without_agreed_date: false,
  } satisfies RepairOrderStatusPermission;

  const primaryRoleTargetPermission = {
    ...currentStatusPermission,
    id: 'perm-primary-target',
    role_id: 'primary-role',
    status_id: 'status-new',
    cannot_continue_without_agreed_date: true,
  } satisfies RepairOrderStatusPermission;

  beforeEach(() => {
    knex = {
      transaction: jest.fn(),
      raw: jest.fn(),
    };

    permissionService = {
      findByRolesAndBranch: jest.fn(),
      checkPermissionsOrThrow: jest.fn(),
    } as unknown as Mocked<RepairOrderStatusPermissionsService>;

    changeLogger = {
      logMultipleFieldsIfChanged: jest.fn().mockResolvedValue(undefined),
    } as unknown as Mocked<RepairOrderChangeLoggerService>;

    initialProblemUpdater = {
      update: jest.fn().mockResolvedValue(undefined),
    } as unknown as Mocked<InitialProblemUpdaterService>;

    finalProblemUpdater = {
      update: jest.fn().mockResolvedValue(undefined),
    } as unknown as Mocked<FinalProblemUpdaterService>;

    helper = {
      getRepairOrderNotificationMeta: jest.fn().mockResolvedValue({}),
    } as unknown as Mocked<RepairOrderCreateHelperService>;

    redisService = {
      flushByPrefix: jest.fn().mockResolvedValue(undefined),
    } as unknown as Mocked<RedisService>;

    logger = {
      error: jest.fn(),
      log: jest.fn(),
    } as unknown as Mocked<LoggerService>;

    pdfService = {} as Mocked<PdfService>;
    webhookService = {} as Mocked<RepairOrderWebhookService>;
    notificationService = {
      notifyBranch: jest.fn().mockResolvedValue(undefined),
    } as unknown as Mocked<NotificationService>;

    service = new RepairOrdersService(
      knex as any,
      permissionService as any,
      changeLogger as any,
      initialProblemUpdater as any,
      finalProblemUpdater as any,
      helper as any,
      redisService as any,
      logger as any,
      pdfService as any,
      webhookService as any,
      notificationService as any,
    );

    jest.spyOn(service as any, 'moveToTop').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'emitMoveNotification').mockImplementation(() => undefined);
    jest.spyOn(service as any, 'notifyRepairOrderUpdate').mockResolvedValue(undefined);
  });

  it('rejects move when target permission is missing for the primary role', async () => {
    const trx = createTransactionMock({
      repair_orders: [order, undefined],
      'repair-order-status-transitions': {
        from_status_id: 'status-old',
        to_status_id: 'status-new',
      },
      repair_order_statuses: { id: 'status-new', type: 'Open' },
      repair_order_rental_phones: undefined,
    });

    knex.transaction.mockResolvedValue(trx);
    permissionService.findByRolesAndBranch.mockResolvedValue([
      currentStatusPermission,
      secondaryRoleTargetPermission,
    ]);
    permissionService.checkPermissionsOrThrow.mockResolvedValue(undefined);

    await expect(
      service.move(admin, order.id, { status_id: 'status-new', sort: 1 }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects move when agreed date is required by the primary role target policy', async () => {
    const trx = createTransactionMock({
      repair_orders: [order, undefined],
      'repair-order-status-transitions': {
        from_status_id: 'status-old',
        to_status_id: 'status-new',
      },
      repair_order_statuses: { id: 'status-new', type: 'Open' },
      repair_order_rental_phones: undefined,
    });

    knex.transaction.mockResolvedValue(trx);
    permissionService.findByRolesAndBranch.mockResolvedValue([
      currentStatusPermission,
      secondaryRoleTargetPermission,
      primaryRoleTargetPermission,
    ]);
    permissionService.checkPermissionsOrThrow.mockResolvedValue(undefined);

    await expect(
      service.move(admin, order.id, { status_id: 'status-new', sort: 1 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('allows same-status move reordering without destination validation', async () => {
    const trx = createTransactionMock({
      repair_orders: [order],
    });

    knex.transaction.mockResolvedValue(trx);
    permissionService.findByRolesAndBranch.mockResolvedValue([currentStatusPermission]);
    permissionService.checkPermissionsOrThrow.mockResolvedValue(undefined);

    await expect(
      service.move(admin, order.id, { status_id: order.status_id, sort: 1 }),
    ).resolves.toEqual({ message: 'Repair order moved successfully' });
  });

  it('applies the same strict destination policy in update()', async () => {
    const trx = createTransactionMock({
      repair_orders: [order, { ...order, status_id: 'status-new', sort: 999999 }],
      'repair-order-status-transitions': {
        from_status_id: 'status-old',
        to_status_id: 'status-new',
      },
      repair_order_statuses: { id: 'status-new', type: 'Open' },
      repair_order_rental_phones: undefined,
    });

    knex.transaction.mockResolvedValue(trx);
    permissionService.findByRolesAndBranch.mockResolvedValue([
      currentStatusPermission,
      primaryRoleTargetPermission,
    ]);
    permissionService.checkPermissionsOrThrow.mockResolvedValue(undefined);

    await expect(
      service.update(admin, order.id, { status_id: 'status-new' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('auto-links a user during update when valid name and phone_number are provided', async () => {
    const orderWithoutUser: RepairOrder = {
      ...order,
      user_id: null,
      name: null,
      phone_number: '+998901234567',
    };
    const trx = createTransactionMock({
      repair_orders: [orderWithoutUser],
    });

    knex.transaction.mockResolvedValue(trx);
    permissionService.findByRolesAndBranch.mockResolvedValue([currentStatusPermission]);
    permissionService.checkPermissionsOrThrow.mockResolvedValue(undefined);

    const ensureUserByPhoneSpy = jest
      .spyOn(service as any, 'ensureUserByPhone')
      .mockResolvedValue('linked-user-id');

    await expect(
      service.update(admin, order.id, {
        name: 'Alisher Rizayev',
        phone_number: '+998901234567',
      } as any),
    ).resolves.toEqual({ message: 'Repair order updated successfully' });

    expect(ensureUserByPhoneSpy).toHaveBeenCalledWith(
      trx,
      '+998901234567',
      expect.objectContaining({
        allowCreate: true,
        name: 'Alisher Rizayev',
      }),
    );
  });

  it('moves with auto-linking even when can_create_user is false', async () => {
    const orderWithoutUser: RepairOrder = {
      ...order,
      user_id: null,
    };
    const trx = createTransactionMock({
      repair_orders: [orderWithoutUser],
      'repair-order-status-transitions': {
        from_status_id: 'status-old',
        to_status_id: 'status-new',
      },
      repair_order_statuses: { id: 'status-new', type: 'Open' },
      repair_order_rental_phones: undefined,
    });
    const targetPermission = {
      ...currentStatusPermission,
      id: 'perm-primary-target-no-create',
      status_id: 'status-new',
      can_create_user: false,
    } satisfies RepairOrderStatusPermission;

    knex.transaction.mockResolvedValue(trx);
    permissionService.findByRolesAndBranch.mockResolvedValue([
      currentStatusPermission,
      targetPermission,
    ]);
    permissionService.checkPermissionsOrThrow.mockResolvedValue(undefined);

    const ensureUserLinkedSpy = jest
      .spyOn(service as any, 'ensureUserLinked')
      .mockResolvedValue('linked-user-id');

    await expect(
      service.move(admin, order.id, { status_id: 'status-new', sort: 1 }),
    ).resolves.toEqual({ message: 'Repair order moved successfully' });

    expect(ensureUserLinkedSpy).toHaveBeenCalledWith(trx, orderWithoutUser, admin.id);
  });

  it('stores parsed first and last name when creating a user from a full name', async () => {
    const existingUserQuery = {
      whereIn: jest.fn().mockReturnThis(),
      andWhereNot: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(undefined),
    };
    const insertQuery = {
      insert: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([{ id: 'new-user-id' }]),
    };
    const trx = jest
      .fn()
      .mockReturnValueOnce(existingUserQuery)
      .mockReturnValueOnce(insertQuery) as any;

    const userId = await (service as any).ensureUserByPhone(trx, '+998901234567', {
      allowCreate: true,
      source: 'employee',
      createdBy: admin.id,
      phoneVerified: false,
      logContext: 'Manual User',
      name: 'Alisher Rizayev',
    });

    expect(userId).toBe('new-user-id');
    expect(insertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        first_name: 'Alisher',
        last_name: 'Rizayev',
        phone_number1: '+998901234567',
      }),
    );
    expect((service as any).parseCustomerNameOrThrow('Alisher')).toEqual({
      fullName: 'Alisher',
      firstName: 'Alisher',
      lastName: null,
    });
  });

  it('fills missing name fields on an existing user matched by phone number', async () => {
    const existingUserQuery = {
      whereIn: jest.fn().mockReturnThis(),
      andWhereNot: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue({
        id: 'existing-user-id',
        first_name: null,
        last_name: null,
      }),
    };
    const updateQuery = {
      where: jest.fn().mockReturnThis(),
      update: jest.fn().mockResolvedValue(1),
    };
    const trx = jest
      .fn()
      .mockReturnValueOnce(existingUserQuery)
      .mockReturnValueOnce(updateQuery) as any;

    const userId = await (service as any).ensureUserByPhone(trx, '+998901234567', {
      allowCreate: true,
      source: 'employee',
      createdBy: admin.id,
      phoneVerified: false,
      logContext: 'Manual User',
      name: 'Alisher Rizayev',
    });

    expect(userId).toBe('existing-user-id');
    expect(updateQuery.where).toHaveBeenCalledWith({ id: 'existing-user-id' });
    expect(updateQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        first_name: 'Alisher',
        last_name: 'Rizayev',
      }),
    );
  });
});
