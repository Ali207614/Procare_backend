import { BadRequestException } from '@nestjs/common';
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

type QueryBuilderRecorder = {
  updates: Array<Record<string, unknown>>;
  inserts: Array<Record<string, unknown>>;
};

type QueryBuilderMock = {
  where: jest.Mock<QueryBuilderMock, [string | Record<string, unknown>, unknown?, unknown?]>;
  andWhere: jest.Mock<QueryBuilderMock, [string | Record<string, unknown>, unknown?, unknown?]>;
  whereIn: jest.Mock<QueryBuilderMock, [string, unknown[]]>;
  whereNot: jest.Mock<QueryBuilderMock, [string | Record<string, unknown>, unknown?]>;
  whereNotIn: jest.Mock<QueryBuilderMock, [string, unknown[]]>;
  orderBy: jest.Mock<QueryBuilderMock, [string, ('asc' | 'desc')?]>;
  select: jest.Mock<QueryBuilderMock, unknown[]>;
  first: jest.Mock<Promise<unknown>, []>;
  update: jest.Mock<Promise<number>, [Record<string, unknown>]>;
  insert: jest.Mock<
    {
      returning: jest.Mock<Promise<unknown[]>, [string | string[]]>;
    },
    [Record<string, unknown>]
  >;
  decrement: jest.Mock<Promise<number>, [string, number]>;
  increment: jest.Mock<Promise<number>, [string, number]>;
};

type TransactionMock = ((table: string) => QueryBuilderMock) & {
  commit: jest.Mock<Promise<void>, []>;
  rollback: jest.Mock<Promise<void>, []>;
  recorders: Record<string, QueryBuilderRecorder[]>;
};

function createQueryBuilder(result: unknown, recorder: QueryBuilderRecorder): QueryBuilderMock {
  const builder = {
    where: jest.fn(),
    andWhere: jest.fn(),
    whereIn: jest.fn(),
    whereNot: jest.fn(),
    whereNotIn: jest.fn(),
    orderBy: jest.fn(),
    select: jest.fn(),
    first: jest.fn().mockResolvedValue(result),
    update: jest.fn().mockImplementation(async (payload: Record<string, unknown>) => {
      recorder.updates.push(payload);
      return 1;
    }),
    insert: jest.fn().mockImplementation((payload: Record<string, unknown>) => {
      recorder.inserts.push(payload);
      return {
        returning: jest.fn().mockResolvedValue([
          {
            id: 'generated-id',
            number_id: 1010,
            total: '0',
            delivery_method: 'Self',
            pickup_method: 'Self',
            priority_level: 2,
            status: 'Open',
            call_count: 0,
            missed_calls: 0,
            source: 'Qolda',
            region_id: payload.region_id ?? null,
            ...payload,
          },
        ]),
      };
    }),
    decrement: jest.fn().mockResolvedValue(1),
    increment: jest.fn().mockResolvedValue(1),
  } satisfies QueryBuilderMock;

  builder.where.mockReturnValue(builder);
  builder.andWhere.mockReturnValue(builder);
  builder.whereIn.mockReturnValue(builder);
  builder.whereNot.mockReturnValue(builder);
  builder.whereNotIn.mockReturnValue(builder);
  builder.orderBy.mockReturnValue(builder);
  builder.select.mockReturnValue(builder);

  return builder;
}

function createTransactionMock(resolvers: Record<string, unknown | unknown[]>): TransactionMock {
  const recorders: Record<string, QueryBuilderRecorder[]> = {};
  const counters = new Map<string, number>();

  const trx = ((table: string): QueryBuilderMock => {
    const resolver = resolvers[table];
    const currentIndex = counters.get(table) ?? 0;
    counters.set(table, currentIndex + 1);

    const result = Array.isArray(resolver) ? resolver[currentIndex] : resolver;
    const recorder: QueryBuilderRecorder = { updates: [], inserts: [] };
    const existingRecorders = recorders[table] ?? [];
    existingRecorders.push(recorder);
    recorders[table] = existingRecorders;

    return createQueryBuilder(result, recorder);
  }) as TransactionMock;

  trx.commit = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
  trx.rollback = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
  trx.recorders = recorders;

  return trx;
}

describe('RepairOrdersService region validation', () => {
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
    roles: [{ id: 'role-id', name: 'Manager' }],
  };

  const permission = {
    id: 'perm-id',
    branch_id: 'branch-id',
    status_id: 'status-id',
    role_id: 'role-id',
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
    can_create_user: true,
    cannot_continue_without_imei: false,
    cannot_continue_without_reject_cause: false,
    cannot_continue_without_agreed_date: false,
    cannot_continue_without_service_form: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } satisfies RepairOrderStatusPermission;

  const baseOrder: RepairOrder = {
    id: 'order-id',
    number_id: 1001,
    user_id: null,
    branch_id: 'branch-id',
    total: '0',
    imei: null,
    phone_category_id: 'phone-category-id',
    status_id: 'status-id',
    delivery_method: 'Self',
    pickup_method: 'Self',
    sort: 1,
    priority: 'Medium',
    priority_level: 2,
    agreed_date: null,
    reject_cause_id: null,
    region_id: null,
    created_by: 'admin-id',
    status: 'Open',
    phone_number: '+998901234567',
    name: 'Client Name',
    description: null,
    source: 'Qolda',
    call_count: 0,
    missed_calls: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

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
      insertAssignAdmins: jest.fn().mockResolvedValue(undefined),
      insertRentalPhone: jest.fn().mockResolvedValue(undefined),
      insertInitialProblems: jest.fn().mockResolvedValue(undefined),
      insertFinalProblems: jest.fn().mockResolvedValue(undefined),
      insertComments: jest.fn().mockResolvedValue(undefined),
      insertPickup: jest.fn().mockResolvedValue(undefined),
      insertDelivery: jest.fn().mockResolvedValue(undefined),
      getRepairOrderNotificationMeta: jest.fn().mockResolvedValue(null),
    } as unknown as Mocked<RepairOrderCreateHelperService>;

    redisService = {
      flushByPrefix: jest.fn().mockResolvedValue(undefined),
    } as unknown as Mocked<RedisService>;

    logger = {
      error: jest.fn(),
      log: jest.fn(),
    } as unknown as Mocked<LoggerService>;

    pdfService = {} as Mocked<PdfService>;
    webhookService = {
      sendWebhook: jest.fn().mockResolvedValue(undefined),
    } as unknown as Mocked<RepairOrderWebhookService>;
    notificationService = {
      notifyBranch: jest.fn().mockResolvedValue(undefined),
    } as unknown as Mocked<NotificationService>;

    service = new RepairOrdersService(
      knex as never,
      permissionService as never,
      changeLogger as never,
      initialProblemUpdater as never,
      finalProblemUpdater as never,
      helper as never,
      redisService as never,
      logger as never,
      pdfService as never,
      webhookService as never,
      notificationService as never,
    );

    const serviceWithPrivateMethods = service as unknown as {
      moveToTop: (trx: unknown, order: RepairOrder) => Promise<void>;
      notifyRepairOrderUpdate: (
        order: RepairOrder,
        payload: {
          title: string;
          message: string;
          action: string;
          openMenu?: boolean;
          targetAdminId?: string | null;
          fromStatusId?: string;
          toStatusId?: string;
        },
      ) => Promise<void>;
      resolveCreateStatus: (
        trx: unknown,
        branchId: string,
        statusId?: string,
      ) => Promise<{ id: string }>;
      ensureUserByPhone: (
        trx: unknown,
        phoneNumber: string,
        options: Record<string, unknown>,
      ) => Promise<string | undefined>;
    };

    jest.spyOn(serviceWithPrivateMethods, 'moveToTop').mockResolvedValue(undefined);
    jest.spyOn(serviceWithPrivateMethods, 'notifyRepairOrderUpdate').mockResolvedValue(undefined);
    jest.spyOn(serviceWithPrivateMethods, 'resolveCreateStatus').mockResolvedValue({
      id: 'status-id',
    });
    jest.spyOn(serviceWithPrivateMethods, 'ensureUserByPhone').mockResolvedValue(undefined);

    permissionService.findByRolesAndBranch.mockResolvedValue([permission]);
    permissionService.checkPermissionsOrThrow.mockResolvedValue(undefined);
  });

  it('rejects create when region_id does not exist', async () => {
    const trx = createTransactionMock({
      repair_order_regions: undefined,
    });
    knex.transaction.mockResolvedValue(trx);

    await expect(
      service.create(admin, 'branch-id', {
        branch_id: 'branch-id',
        phone_number: '+998901234567',
        region_id: 'missing-region-id',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('persists region_id during create when the region exists', async () => {
    const trx = createTransactionMock({
      repair_order_regions: { id: 'region-id', title: 'Tashkent', description: null },
      repair_orders: [undefined],
    });
    knex.transaction.mockResolvedValue(trx);

    await expect(
      service.create(admin, 'branch-id', {
        branch_id: 'branch-id',
        phone_number: '+998901234567',
        region_id: 'region-id',
      }),
    ).resolves.toMatchObject({
      region_id: 'region-id',
    });

    const insertRecorder = trx.recorders['repair_orders'].find(
      (recorder) => recorder.inserts.length > 0,
    );

    expect(insertRecorder?.inserts[0]).toMatchObject({
      region_id: 'region-id',
    });
  });

  it('rejects update when region_id does not exist', async () => {
    const trx = createTransactionMock({
      repair_orders: [baseOrder],
      repair_order_regions: undefined,
    });
    knex.transaction.mockResolvedValue(trx);

    await expect(
      service.update(admin, baseOrder.id, {
        region_id: 'missing-region-id',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('persists region_id during update when the region exists', async () => {
    const trx = createTransactionMock({
      repair_orders: [baseOrder],
      repair_order_regions: { id: 'region-id', title: 'Region', description: null },
    });
    knex.transaction.mockResolvedValue(trx);

    await expect(
      service.update(admin, baseOrder.id, {
        region_id: 'region-id',
      }),
    ).resolves.toEqual({ message: 'Repair order updated successfully' });

    expect(trx.recorders['repair_orders'][1].updates[0]).toMatchObject({
      region_id: 'region-id',
    });
  });
});
