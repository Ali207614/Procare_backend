import { AssignAdminUpdaterService } from 'src/repair-orders/services/assign-admin-updater.service';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { RepairOrder } from 'src/common/types/repair-order.interface';

type BuilderConfig = {
  firstResult?: unknown;
  pluckResult?: unknown[];
  deleteResult?: number;
};

function createBuilder(config: BuilderConfig = {}) {
  return {
    where: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(config.firstResult),
    pluck: jest.fn().mockResolvedValue(config.pluckResult ?? []),
    delete: jest.fn().mockResolvedValue(config.deleteResult ?? 0),
    insert: jest.fn().mockReturnThis(),
    onConflict: jest.fn().mockReturnThis(),
    ignore: jest.fn().mockResolvedValue(undefined),
  };
}

function createKnexMock(tableConfigs: Record<string, BuilderConfig[]>) {
  const builders: Record<string, ReturnType<typeof createBuilder>[]> = {};
  const callCounts = new Map<string, number>();

  const trx = ((table: string) => {
    const index = callCounts.get(table) ?? 0;
    callCounts.set(table, index + 1);

    const configs = tableConfigs[table] ?? [{}];
    const builder = createBuilder(configs[Math.min(index, configs.length - 1)]);

    builders[table] = builders[table] ?? [];
    builders[table].push(builder);

    return builder;
  }) as any;

  const knex = {
    transaction: jest.fn(async (callback: (transaction: typeof trx) => Promise<unknown>) =>
      callback(trx),
    ),
  };

  return { knex, builders };
}

describe('AssignAdminUpdaterService', () => {
  const admin: AdminPayload = {
    id: 'admin-id',
    phone_number: '+998901234567',
    roles: [{ id: 'role-id', name: 'Repair Admin' }],
  };

  const order = {
    id: 'order-id',
    branch_id: 'branch-id',
    status_id: 'status-id',
  } as RepairOrder;

  const permissionService = {
    findByRolesAndBranch: jest.fn(),
    checkPermissionsOrThrow: jest.fn(),
  };
  const changeLogger = {
    logIfChanged: jest.fn(),
  };
  const notificationService = {
    notifyAdmins: jest.fn(),
  };
  const redisService = {
    flushByPrefix: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    permissionService.findByRolesAndBranch.mockResolvedValue([]);
    permissionService.checkPermissionsOrThrow.mockResolvedValue(undefined);
  });

  it('clears all assigned admins when admin_ids is empty', async () => {
    const { knex, builders } = createKnexMock({
      repair_orders: [{ firstResult: order }],
      repair_order_assign_admins: [
        { pluckResult: ['admin-1', 'admin-2'] },
        { deleteResult: 2 },
      ],
    });
    const service = new AssignAdminUpdaterService(
      knex as never,
      permissionService as never,
      changeLogger as never,
      notificationService as never,
      redisService as never,
    );

    await service.create(order.id, [], admin);

    expect(permissionService.checkPermissionsOrThrow).toHaveBeenCalledWith(
      admin.roles,
      order.branch_id,
      order.status_id,
      ['can_assign_admin'],
      'repair_order_update',
      [],
    );
    expect(builders.repair_order_assign_admins[0].pluck).toHaveBeenCalledWith('admin_id');
    expect(builders.repair_order_assign_admins[1].delete).toHaveBeenCalledWith();
    expect(changeLogger.logIfChanged).toHaveBeenCalledWith(
      expect.anything(),
      order.id,
      'admin_ids',
      ['admin-1', 'admin-2'],
      [],
      admin.id,
    );
    expect(notificationService.notifyAdmins).not.toHaveBeenCalled();
    expect(redisService.flushByPrefix).toHaveBeenCalledWith('repair_orders:branch-id');
  });
});
