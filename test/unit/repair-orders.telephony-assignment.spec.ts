import { RepairOrdersService } from '../../src/repair-orders/repair-orders.service';

type Builder = {
  where: jest.Mock;
  andWhere: jest.Mock;
  whereNotIn: jest.Mock;
  whereNot: jest.Mock;
  whereIn: jest.Mock;
  whereRaw: jest.Mock;
  first: jest.Mock;
  pluck: jest.Mock;
  insert: jest.Mock;
  returning: jest.Mock;
  update: jest.Mock;
  join: jest.Mock;
  leftJoin: jest.Mock;
  select: jest.Mock;
  groupBy: jest.Mock;
  orderByRaw: jest.Mock;
  onConflict: jest.Mock;
  ignore: jest.Mock;
};

const createBuilder = (): Builder => {
  const builder: Partial<Builder> = {};
  builder.where = jest.fn().mockReturnValue(builder);
  builder.andWhere = jest.fn().mockReturnValue(builder);
  builder.whereNotIn = jest.fn().mockReturnValue(builder);
  builder.whereNot = jest.fn().mockReturnValue(builder);
  builder.whereIn = jest.fn().mockReturnValue(builder);
  builder.whereRaw = jest.fn().mockReturnValue(builder);
  builder.first = jest.fn();
  builder.pluck = jest.fn();
  builder.insert = jest.fn().mockReturnValue(builder);
  builder.returning = jest.fn();
  builder.update = jest.fn().mockResolvedValue(undefined);
  builder.join = jest.fn().mockReturnValue(builder);
  builder.leftJoin = jest.fn().mockReturnValue(builder);
  builder.select = jest.fn().mockReturnValue(builder);
  builder.groupBy = jest.fn().mockReturnValue(builder);
  builder.orderByRaw = jest.fn().mockReturnValue(builder);
  builder.onConflict = jest.fn().mockReturnValue(builder);
  builder.ignore = jest.fn().mockResolvedValue(undefined);
  return builder as Builder;
};

type TransactionMock = jest.Mock & {
  commit: jest.Mock;
  rollback: jest.Mock;
};

describe('RepairOrdersService telephony assignment', () => {
  let service: RepairOrdersService;
  let knex: jest.Mock & { transaction: jest.Mock; raw: jest.Mock };
  let redisService: { flushByPrefix: jest.Mock };
  let logger: { log: jest.Mock; warn: jest.Mock; error: jest.Mock };

  beforeEach(() => {
    knex = jest.fn() as jest.Mock & { transaction: jest.Mock; raw: jest.Mock };
    knex.transaction = jest.fn();
    knex.raw = jest.fn().mockReturnValue('call_count + 1');

    redisService = {
      flushByPrefix: jest.fn().mockResolvedValue(undefined),
    };

    logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    service = new RepairOrdersService(
      knex as any,
      { findByRolesAndBranch: jest.fn(), checkPermissionsOrThrow: jest.fn() } as any,
      { logMultipleFieldsIfChanged: jest.fn(), logIfChanged: jest.fn() } as any,
      {} as any,
      {} as any,
      { insertAssignAdmins: jest.fn(), getRepairOrderNotificationMeta: jest.fn() } as any,
      redisService as any,
      logger as any,
      {} as any,
      { sendWebhook: jest.fn().mockResolvedValue(undefined) } as any,
      { notifyBranch: jest.fn(), notifyAdmins: jest.fn(), broadcastToAdmins: jest.fn() } as any,
    );

    jest.spyOn(service as any, 'moveToTop').mockResolvedValue(undefined);
    jest
      .spyOn(service as any, 'notifyRepairOrderUpdate')
      .mockImplementation(() => Promise.resolve());
  });

  it('scopes PBX-code assignment to the webhook branch when creating an order', async () => {
    const repairOrdersBuilder = createBuilder();
    repairOrdersBuilder.returning.mockResolvedValue([
      {
        id: 'order-1',
        number_id: 1,
        branch_id: 'branch-1',
        status_id: 'status-1',
        sort: 999999,
      },
    ]);

    const adminsBuilder = createBuilder();
    adminsBuilder.first.mockResolvedValue({ id: 'admin-in-branch' });

    const targetRolesBuilder = createBuilder();
    targetRolesBuilder.pluck.mockResolvedValue(['role-1']);

    const sharedRoleBuilder = createBuilder();
    sharedRoleBuilder.first.mockResolvedValue(undefined);

    const assignBuilder = createBuilder();

    const trx = jest.fn((table: string) => {
      if (table === 'repair_orders') return repairOrdersBuilder;
      if (table === 'admins as a') return adminsBuilder;
      if (table === 'admin_roles as ar') return targetRolesBuilder;
      if (table === 'repair_order_assign_admins as raa') return sharedRoleBuilder;
      if (table === 'repair_order_assign_admins') return assignBuilder;
      throw new Error(`Unexpected table ${table}`);
    }) as TransactionMock;

    trx.commit = jest.fn().mockResolvedValue(undefined);
    trx.rollback = jest.fn().mockResolvedValue(undefined);

    knex.transaction.mockResolvedValue(trx);

    await service.createFromWebhook({
      userId: 'user-1',
      branchId: 'branch-1',
      statusId: 'status-1',
      phoneNumber: '+998901234567',
      source: 'Kiruvchi qongiroq',
      onlinepbxCode: '120',
      fallbackToFewestOpen: false,
    });

    expect(adminsBuilder.where).toHaveBeenCalledWith({
      'a.onlinepbx_code': '120',
      'a.is_active': true,
      'a.status': 'Open',
      'ab.branch_id': 'branch-1',
    });
    expect(assignBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        repair_order_id: 'order-1',
        admin_id: 'admin-in-branch',
      }),
    );
    expect(assignBuilder.onConflict).toHaveBeenCalledWith(['repair_order_id', 'admin_id']);
    expect(assignBuilder.ignore).toHaveBeenCalled();
  });

  it('adds the answering admin to an existing order on call_answered', async () => {
    const orderBuilder = createBuilder();
    orderBuilder.first.mockResolvedValue({
      id: 'order-1',
      number_id: 1,
      branch_id: 'branch-1',
      status_id: 'status-1',
      sort: 2,
      status: 'Open',
      phone_number: '+998901234567',
    });

    const adminsBuilder = createBuilder();
    adminsBuilder.first.mockResolvedValue({ id: 'admin-120' });

    const targetRolesBuilder = createBuilder();
    targetRolesBuilder.pluck.mockResolvedValue(['role-1']);

    const sharedRoleBuilder = createBuilder();
    sharedRoleBuilder.first.mockResolvedValue(undefined);

    const assignBuilder = createBuilder();

    const trx = jest.fn((table: string) => {
      if (table === 'repair_orders as ro') return orderBuilder;
      if (table === 'repair_orders') return orderBuilder;
      if (table === 'admins as a') return adminsBuilder;
      if (table === 'admin_roles as ar') return targetRolesBuilder;
      if (table === 'repair_order_assign_admins as raa') return sharedRoleBuilder;
      if (table === 'repair_order_assign_admins') return assignBuilder;
      throw new Error(`Unexpected table ${table}`);
    }) as TransactionMock;

    trx.commit = jest.fn().mockResolvedValue(undefined);
    trx.rollback = jest.fn().mockResolvedValue(undefined);

    knex.transaction.mockResolvedValue(trx);

    await service.handleCallAnswered({
      branchId: 'branch-1',
      phoneNumber: '+998901234567',
      onlinepbxCode: '120',
      userId: 'user-1',
      openMenu: true,
      source: 'Kiruvchi qongiroq',
    });

    expect(orderBuilder.update).toHaveBeenCalledWith({
      updated_at: expect.any(String),
      call_count: 'call_count + 1',
    });
    expect(assignBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        repair_order_id: 'order-1',
        admin_id: 'admin-120',
      }),
    );
    expect(assignBuilder.onConflict).toHaveBeenCalledWith(['repair_order_id', 'admin_id']);
    expect(assignBuilder.ignore).toHaveBeenCalled();
  });

  it('assigns the calling admin to an existing order on outbound call_start', async () => {
    const orderBuilder = createBuilder();
    orderBuilder.first
      .mockResolvedValueOnce({
        id: 'order-1',
        branch_id: 'branch-1',
        status: 'Open',
      })
      .mockResolvedValueOnce(undefined);

    const adminsBuilder = createBuilder();
    adminsBuilder.first.mockResolvedValue({ id: 'admin-120' });

    const targetRolesBuilder = createBuilder();
    targetRolesBuilder.pluck.mockResolvedValue(['role-1']);

    const sharedRoleBuilder = createBuilder();
    sharedRoleBuilder.first.mockResolvedValue(undefined);

    const assignBuilder = createBuilder();

    const trx = jest.fn((table: string) => {
      if (table === 'repair_orders') return orderBuilder;
      if (table === 'admins as a') return adminsBuilder;
      if (table === 'admin_roles as ar') return targetRolesBuilder;
      if (table === 'repair_order_assign_admins as raa') return sharedRoleBuilder;
      if (table === 'repair_order_assign_admins') return assignBuilder;
      throw new Error(`Unexpected table ${table}`);
    }) as TransactionMock;

    trx.commit = jest.fn().mockResolvedValue(undefined);
    trx.rollback = jest.fn().mockResolvedValue(undefined);

    knex.transaction.mockResolvedValue(trx);

    await service.assignTelephonyAdminToExistingOrder({
      branchId: 'branch-1',
      orderId: 'order-1',
      onlinepbxCode: '120',
    });

    expect(adminsBuilder.where).toHaveBeenCalledWith({
      'a.onlinepbx_code': '120',
      'a.is_active': true,
      'a.status': 'Open',
      'ab.branch_id': 'branch-1',
    });
    expect(assignBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        repair_order_id: 'order-1',
        admin_id: 'admin-120',
      }),
    );
    expect(assignBuilder.onConflict).toHaveBeenCalledWith(['repair_order_id', 'admin_id']);
    expect(assignBuilder.ignore).toHaveBeenCalled();
    expect(redisService.flushByPrefix).toHaveBeenCalledWith('repair_orders:branch-1');
  });

  it('skips assigning the answering admin when an assigned admin already has the same role', async () => {
    const orderBuilder = createBuilder();
    orderBuilder.first.mockResolvedValue({
      id: 'order-1',
      number_id: 1,
      branch_id: 'branch-1',
      status_id: 'status-1',
      sort: 2,
      status: 'Open',
      phone_number: '+998901234567',
    });

    const adminsBuilder = createBuilder();
    adminsBuilder.first.mockResolvedValue({ id: 'admin-120' });

    const targetRolesBuilder = createBuilder();
    targetRolesBuilder.pluck.mockResolvedValue(['role-1']);

    const sharedRoleBuilder = createBuilder();
    sharedRoleBuilder.first.mockResolvedValue({ admin_id: 'existing-admin' });

    const assignBuilder = createBuilder();

    const trx = jest.fn((table: string) => {
      if (table === 'repair_orders as ro') return orderBuilder;
      if (table === 'repair_orders') return orderBuilder;
      if (table === 'admins as a') return adminsBuilder;
      if (table === 'admin_roles as ar') return targetRolesBuilder;
      if (table === 'repair_order_assign_admins as raa') return sharedRoleBuilder;
      if (table === 'repair_order_assign_admins') return assignBuilder;
      throw new Error(`Unexpected table ${table}`);
    }) as TransactionMock;

    trx.commit = jest.fn().mockResolvedValue(undefined);
    trx.rollback = jest.fn().mockResolvedValue(undefined);

    knex.transaction.mockResolvedValue(trx);

    await service.handleCallAnswered({
      branchId: 'branch-1',
      phoneNumber: '+998901234567',
      onlinepbxCode: '120',
      userId: 'user-1',
      openMenu: true,
      source: 'Kiruvchi qongiroq',
    });

    expect(assignBuilder.insert).not.toHaveBeenCalled();
  });

  it('broadcasts open_menu only to available assigned admins for incoming calls', async () => {
    const orderBuilder = createBuilder();
    orderBuilder.first.mockResolvedValue({
      id: 'order-1',
      number_id: 1001,
      branch_id: 'branch-1',
      status: 'Open',
    });

    const availableAdminsBuilder = createBuilder();
    availableAdminsBuilder.pluck.mockResolvedValue(['admin-1']);

    const helper = {
      insertAssignAdmins: jest.fn(),
      getRepairOrderNotificationMeta: jest.fn().mockResolvedValue({
        order_id: 'order-1',
        number_id: '1001',
        sort: 1,
        phone_category_name: null,
        user_full_name: 'Test User',
        user_phone_number: '+998901234567',
        pickup_method: 'Self',
        delivery_method: 'Self',
        priority: 'Medium',
        source: 'Kiruvchi qongiroq',
        assigned_admins: 'Assigned Admin',
      }),
    };
    const notificationService = {
      notifyBranch: jest.fn(),
      notifyAdmins: jest.fn(),
      broadcastToAdmins: jest.fn(),
    };

    service = new RepairOrdersService(
      knex as any,
      { findByRolesAndBranch: jest.fn(), checkPermissionsOrThrow: jest.fn() } as any,
      { logMultipleFieldsIfChanged: jest.fn(), logIfChanged: jest.fn() } as any,
      {} as any,
      {} as any,
      helper as any,
      redisService as any,
      logger as any,
      {} as any,
      { sendWebhook: jest.fn().mockResolvedValue(undefined) } as any,
      notificationService as any,
    );

    const workContextSpy = jest
      .spyOn(service as any, 'getCurrentWorkContext')
      .mockReturnValue({ currentDayStr: 'monday', currentHHmm: '10:00' });

    knex.mockImplementation((table: string) => {
      if (table === 'repair_orders') return orderBuilder;
      if (table === 'repair_order_assign_admins as raa') return availableAdminsBuilder;
      throw new Error(`Unexpected table ${table}`);
    });

    await service.notifyAvailableAssignedAdminsForIncomingCall('order-1');

    expect(availableAdminsBuilder.whereRaw).toHaveBeenCalledWith(
      `(a.work_days->>?)::boolean = true`,
      ['monday'],
    );
    expect(notificationService.broadcastToAdmins).toHaveBeenCalledWith(
      ['admin-1'],
      expect.objectContaining({
        meta: expect.objectContaining({
          open_menu: true,
          action: 'order_updated',
        }),
      }),
    );

    workContextSpy.mockRestore();
  });

  it('treats only workflow-open statuses as reusable for PBX lookups', async () => {
    const orderBuilder = createBuilder();
    orderBuilder.first.mockResolvedValue({
      id: 'order-1',
      number_id: 1,
      branch_id: 'branch-1',
      status_id: 'status-open',
      sort: 1,
      status: 'Open',
      phone_number: '+998901234567',
    });

    knex.mockImplementation((table: string) => {
      if (table === 'repair_orders as ro') return orderBuilder;
      throw new Error(`Unexpected table ${table}`);
    });

    const result = await service.findOpenOrderByPhoneNumber('branch-1', '+998901234567', 'user-1');

    expect(result).toEqual(
      expect.objectContaining({
        id: 'order-1',
      }),
    );
    expect(orderBuilder.join).toHaveBeenCalledWith(
      'repair_order_statuses as ros',
      'ro.status_id',
      'ros.id',
    );
    expect(orderBuilder.whereNotIn).toHaveBeenCalledWith('ro.status', [
      'Cancelled',
      'Deleted',
      'Closed',
    ]);
    expect(orderBuilder.andWhere).toHaveBeenCalledWith({
      'ros.type': 'Open',
      'ros.status': 'Open',
      'ros.is_active': true,
    });
  });

  it('matches legacy raw local-phone orders during PBX lookups', async () => {
    const orderBuilder = createBuilder();
    orderBuilder.first.mockResolvedValue({
      id: 'order-legacy',
      number_id: 2,
      branch_id: 'branch-1',
      status_id: 'status-open',
      sort: 1,
      status: 'Open',
      phone_number: '976191611',
    });

    knex.mockImplementation((table: string) => {
      if (table === 'repair_orders as ro') return orderBuilder;
      throw new Error(`Unexpected table ${table}`);
    });

    const result = await service.findOpenOrderByPhoneNumber('branch-1', '976191611');

    expect(result).toEqual(
      expect.objectContaining({
        id: 'order-legacy',
      }),
    );
    expect(orderBuilder.whereIn).toHaveBeenCalledWith('ro.phone_number', [
      '+998976191611',
      '976191611',
    ]);
  });
});
