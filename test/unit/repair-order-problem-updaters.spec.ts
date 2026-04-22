import { InitialProblemUpdaterService } from '../../src/repair-orders/services/initial-problem-updater.service';
import { FinalProblemUpdaterService } from '../../src/repair-orders/services/final-problem-updater.service';
import { RepairOrderStatusPermissionsService } from '../../src/repair-order-status-permission/repair-order-status-permissions.service';
import { RepairOrderChangeLoggerService } from '../../src/repair-orders/services/repair-order-change-logger.service';
import { AdminPayload } from '../../src/common/types/admin-payload.interface';
import { RepairOrder } from '../../src/common/types/repair-order.interface';
import { RepairOrderStatusPermission } from '../../src/common/types/repair-order-status-permssion.interface';

type Mocked<T> = {
  [K in keyof T]: jest.Mock;
};

type BuilderConfig = {
  result?: unknown;
  firstResult?: unknown;
  deleteMock?: jest.Mock;
};

function createBuilder(config: BuilderConfig = {}) {
  const builder: Record<string, unknown> = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    whereNotNull: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    pluck: jest.fn().mockReturnThis(),
    unionAll: jest.fn().mockReturnThis(),
    withRecursive: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(config.firstResult),
    delete: config.deleteMock ?? jest.fn().mockResolvedValue(1),
    insert: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([]),
    then: (
      resolve?: (value: unknown) => unknown,
      reject?: (reason: unknown) => unknown,
    ): Promise<unknown> => Promise.resolve(config.result).then(resolve, reject),
  };

  return builder;
}

function createTransactionMock(tableConfigs: Record<string, BuilderConfig[]>) {
  const callCounts = new Map<string, number>();

  const trx = ((table: string) => {
    const index = callCounts.get(table) ?? 0;
    callCounts.set(table, index + 1);
    const configs = tableConfigs[table] ?? [{}];
    const config = configs[Math.min(index, configs.length - 1)] ?? {};
    return createBuilder(config);
  }) as unknown as ((table: string) => ReturnType<typeof createBuilder>) & {
    commit: jest.Mock;
    rollback: jest.Mock;
  };

  trx.commit = jest.fn().mockResolvedValue(undefined);
  trx.rollback = jest.fn().mockResolvedValue(undefined);

  return trx;
}

describe('Repair order problem updaters', () => {
  const admin: AdminPayload = {
    id: 'admin-id',
    phone_number: '+998901234567',
    roles: [{ id: 'role-id', name: 'Repair Admin' }],
  };

  const permission: RepairOrderStatusPermission = {
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
    can_notification_bot: false,
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
    cannot_continue_without_service_form: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const order: RepairOrder = {
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

  let permissionService: Mocked<RepairOrderStatusPermissionsService>;
  let changeLogger: Mocked<RepairOrderChangeLoggerService>;
  let initialProblemUpdater!: InitialProblemUpdaterService;
  let finalProblemUpdater!: FinalProblemUpdaterService;

  beforeEach(() => {
    permissionService = {
      findByRolesAndBranch: jest.fn().mockResolvedValue([permission]),
      checkPermissionsOrThrow: jest.fn().mockResolvedValue(undefined),
    } as unknown as Mocked<RepairOrderStatusPermissionsService>;

    changeLogger = {
      logIfChanged: jest.fn().mockResolvedValue(undefined),
    } as unknown as Mocked<RepairOrderChangeLoggerService>;

    initialProblemUpdater = new InitialProblemUpdaterService(
      permissionService as unknown as RepairOrderStatusPermissionsService,
      changeLogger as unknown as RepairOrderChangeLoggerService,
    );

    finalProblemUpdater = new FinalProblemUpdaterService(
      permissionService as unknown as RepairOrderStatusPermissionsService,
      changeLogger as unknown as RepairOrderChangeLoggerService,
    );
  });

  it.each([
    ['initial', () => initialProblemUpdater],
    ['final', () => finalProblemUpdater],
  ] as const)('returns immediately when %s problems are undefined', async (_label, getUpdater) => {
    const trx = createTransactionMock({});

    await getUpdater().update(trx as never, order.id, undefined, admin);

    expect(permissionService.findByRolesAndBranch).not.toHaveBeenCalled();
    expect(permissionService.checkPermissionsOrThrow).not.toHaveBeenCalled();
    expect(changeLogger.logIfChanged).not.toHaveBeenCalled();
    expect(trx.commit).not.toHaveBeenCalled();
    expect(trx.rollback).not.toHaveBeenCalled();
  });

  it.each([
    ['initial', () => initialProblemUpdater, 'repair_order_initial_problems', 'repair_order_parts'],
    ['final', () => finalProblemUpdater, 'repair_order_final_problems', 'repair_order_parts'],
  ] as const)(
    'clears all %s problems when an empty array is provided',
    async (_label, getUpdater, problemsTable, partsTable) => {
      const problemsDelete = jest.fn().mockResolvedValue(1);
      const partsDelete = jest.fn().mockResolvedValue(1);

      const trx = createTransactionMock({
        repair_orders: [{ firstResult: order }],
        [problemsTable]: [{ result: [] }, { deleteMock: problemsDelete }],
        [partsTable]: [{ deleteMock: partsDelete }],
      });

      await getUpdater().update(trx as never, order.id, [], admin);

      expect(permissionService.findByRolesAndBranch).toHaveBeenCalledWith(
        admin.roles,
        order.branch_id,
      );
      expect(permissionService.checkPermissionsOrThrow).toHaveBeenCalledWith(
        admin.roles,
        order.branch_id,
        order.status_id,
        [
          problemsTable === 'repair_order_initial_problems'
            ? 'can_change_initial_problems'
            : 'can_change_final_problems',
        ],
        problemsTable === 'repair_order_initial_problems'
          ? 'repair_order_initial_problems'
          : 'repair_order_delivery',
        [permission],
      );
      expect(problemsDelete).toHaveBeenCalledWith();
      expect(partsDelete).toHaveBeenCalledWith();
      expect(changeLogger.logIfChanged).toHaveBeenCalledWith(
        expect.anything(),
        order.id,
        problemsTable === 'repair_order_initial_problems' ? 'initial_problems' : 'final_problems',
        [],
        [],
        admin.id,
      );
    },
  );
});
