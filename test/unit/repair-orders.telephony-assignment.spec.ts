import { RepairOrdersService } from '../../src/repair-orders/repair-orders.service';
import { RoleType } from '../../src/common/types/role-type.enum';

type Builder = {
  where: jest.Mock;
  andWhere: jest.Mock;
  whereNull: jest.Mock;
  whereNotIn: jest.Mock;
  whereNot: jest.Mock;
  whereNotNull: jest.Mock;
  whereIn: jest.Mock;
  whereRaw: jest.Mock;
  andWhereRaw: jest.Mock;
  orWhereRaw: jest.Mock;
  orWhereNotIn: jest.Mock;
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
  delete: jest.Mock;
};

const createBuilder = (): Builder => {
  const builder: Partial<Builder> = {};
  builder.where = jest.fn().mockReturnValue(builder);
  builder.andWhere = jest.fn().mockReturnValue(builder);
  builder.whereNull = jest.fn().mockReturnValue(builder);
  builder.whereNotIn = jest.fn().mockReturnValue(builder);
  builder.whereNot = jest.fn().mockReturnValue(builder);
  builder.whereNotNull = jest.fn().mockReturnValue(builder);
  builder.whereIn = jest.fn().mockReturnValue(builder);
  builder.whereRaw = jest.fn().mockReturnValue(builder);
  builder.andWhereRaw = jest.fn().mockReturnValue(builder);
  builder.orWhereRaw = jest.fn().mockReturnValue(builder);
  builder.orWhereNotIn = jest.fn().mockReturnValue(builder);
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
  builder.delete = jest.fn().mockResolvedValue(undefined);
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
      { recordEntityCreated: jest.fn().mockResolvedValue(null) } as any,
    );

    jest.spyOn(service as any, 'moveToTop').mockResolvedValue(undefined);
    jest
      .spyOn(service as any, 'notifyRepairOrderUpdate')
      .mockImplementation(() => Promise.resolve());
  });

  it('scopes PBX-code assignment to the webhook branch when creating an order', async () => {
    const existingOrderBuilder = createBuilder();
    existingOrderBuilder.first.mockResolvedValue(undefined);

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
    targetRolesBuilder.select.mockResolvedValue([{ role_id: 'role-1', role_name: 'Master' }]);

    const sharedRoleBuilder = createBuilder();
    sharedRoleBuilder.first.mockResolvedValue(undefined);

    const assignBuilder = createBuilder();

    const trx = jest.fn((table: string) => {
      if (table === 'repair_orders as ro') return existingOrderBuilder;
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
    targetRolesBuilder.select.mockResolvedValue([{ role_id: 'role-1', role_name: 'Master' }]);

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

    expect(orderBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        updated_at: expect.any(String),
        call_count: 'call_count + 1',
        customer_no_answer_count: 0,
        last_customer_no_answer_at: null,
        customer_no_answer_due_at: null,
      }),
    );
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
    targetRolesBuilder.select.mockResolvedValue([{ role_id: 'role-1', role_name: 'Master' }]);

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

  it('replaces the automatic same-role admin with the answering admin', async () => {
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
    targetRolesBuilder.select.mockResolvedValue([{ role_id: 'role-1', role_name: 'Master' }]);

    const sharedRoleBuilder = createBuilder();
    sharedRoleBuilder.first.mockResolvedValue(undefined);
    sharedRoleBuilder.delete.mockResolvedValue(1);

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

    expect(sharedRoleBuilder.delete).toHaveBeenCalled();
    expect(sharedRoleBuilder.whereIn).toHaveBeenCalledWith('raa.assignment_source', [
      'telephony_auto',
    ]);
    expect(assignBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        repair_order_id: 'order-1',
        admin_id: 'admin-120',
        assignment_source: 'telephony_answered',
      }),
    );
    expect(assignBuilder.onConflict).toHaveBeenCalledWith(['repair_order_id', 'admin_id']);
    expect(assignBuilder.ignore).toHaveBeenCalled();
  });

  it('keeps a previous answered same-role admin when another admin answers later', async () => {
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
    adminsBuilder.first.mockResolvedValue({ id: 'admin-habib' });

    const targetRolesBuilder = createBuilder();
    targetRolesBuilder.select.mockResolvedValue([{ role_id: 'role-1', role_name: 'Operator' }]);

    const sharedRoleBuilder = createBuilder();
    sharedRoleBuilder.delete.mockResolvedValue(0);
    sharedRoleBuilder.first.mockResolvedValue({
      admin_id: 'admin-mohir',
      assignment_source: 'telephony_answered',
    });

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
      onlinepbxCode: '121',
      userId: 'user-1',
      openMenu: true,
      source: 'Kiruvchi qongiroq',
    });

    expect(sharedRoleBuilder.delete).toHaveBeenCalled();
    expect(sharedRoleBuilder.whereIn).toHaveBeenCalledWith('raa.assignment_source', [
      'telephony_auto',
    ]);
    expect(assignBuilder.insert).not.toHaveBeenCalled();
  });

  it('treats active roles with the same name as the same role during telephony assignment', async () => {
    const targetRolesBuilder = createBuilder();
    targetRolesBuilder.select.mockResolvedValue([
      { role_id: 'role-answered', role_name: 'Master' },
    ]);

    const sharedRoleBuilder = createBuilder();
    sharedRoleBuilder.andWhere.mockImplementation((arg: unknown) => {
      if (typeof arg === 'function') {
        arg(sharedRoleBuilder);
      }
      return sharedRoleBuilder;
    });
    sharedRoleBuilder.first.mockResolvedValue({ admin_id: 'existing-admin' });

    const trx = jest.fn((table: string) => {
      if (table === 'admin_roles as ar') return targetRolesBuilder;
      if (table === 'repair_order_assign_admins as raa') return sharedRoleBuilder;
      throw new Error(`Unexpected table ${table}`);
    }) as TransactionMock;

    const result = await (service as any).hasAssignedAdminWithSameRole(
      trx,
      'order-1',
      'admin-answered',
    );

    expect(result).toBe(true);
    expect(sharedRoleBuilder.whereIn).toHaveBeenCalledWith('ar.role_id', ['role-answered']);
    expect(sharedRoleBuilder.orWhereRaw).toHaveBeenCalledWith(
      'LOWER(BTRIM(r.name)) = ANY(?::text[])',
      [['master']],
    );
  });

  it('auto-assigns the acting specialist after an accepted update', async () => {
    const assignBuilder = createBuilder();

    const trx = jest.fn((table: string) => {
      if (table === 'repair_order_assign_admins') return assignBuilder;
      throw new Error(`Unexpected table ${table}`);
    }) as TransactionMock;

    await (service as any).autoAssignRepairWorkerFromUpdateIfNeeded(trx, 'order-1', {
      id: 'admin-specialist',
      phone_number: '+998901234567',
      roles: [{ id: 'role-specialist', name: 'Spetsialist', type: RoleType.SPECIALIST }],
    });

    expect(assignBuilder.insert).toHaveBeenCalledWith({
      repair_order_id: 'order-1',
      admin_id: 'admin-specialist',
      assignment_source: 'role_update_auto',
      created_at: expect.any(Date),
    });
    expect(assignBuilder.onConflict).toHaveBeenCalledWith(['repair_order_id', 'admin_id']);
  });

  it('looks up cached role IDs without types before update auto-assignment', async () => {
    const rolesBuilder = createBuilder();
    rolesBuilder.select.mockResolvedValue([{ type: RoleType.MASTER }]);

    const assignBuilder = createBuilder();

    const trx = jest.fn((table: string) => {
      if (table === 'roles') return rolesBuilder;
      if (table === 'repair_order_assign_admins') return assignBuilder;
      throw new Error(`Unexpected table ${table}`);
    }) as TransactionMock;

    await (service as any).autoAssignRepairWorkerFromUpdateIfNeeded(trx, 'order-1', {
      id: 'admin-master',
      phone_number: '+998901234567',
      roles: [{ id: 'role-master', name: 'Usta' }],
    });

    expect(rolesBuilder.whereIn).toHaveBeenCalledWith('id', ['role-master']);
    expect(assignBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        repair_order_id: 'order-1',
        admin_id: 'admin-master',
        assignment_source: 'role_update_auto',
      }),
    );
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
      { recordEntityCreated: jest.fn().mockResolvedValue(null) } as any,
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

  it('treats active non-terminal statuses as reusable for PBX lookups', async () => {
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
      'ros.status': 'Open',
      'ros.is_active': true,
    });
    expect(orderBuilder.andWhere).toHaveBeenCalledWith(expect.any(Function));
  });

  it('treats Invalid/Sifatsiz statuses as reusable during the 72 hour PBX grace window', async () => {
    const orderBuilder = createBuilder();
    const statusTypeConditionBuilder = createBuilder();

    orderBuilder.andWhere.mockImplementation((arg: unknown) => {
      if (typeof arg === 'function') {
        arg(statusTypeConditionBuilder);
      }
      return orderBuilder;
    });

    orderBuilder.first.mockResolvedValue({
      id: 'order-invalid-recent',
      number_id: 3,
      branch_id: 'branch-1',
      status_id: 'status-invalid',
      sort: 1,
      status: 'Open',
      phone_number: '+998901234567',
    });

    knex.mockImplementation((table: string) => {
      if (table === 'repair_orders as ro') return orderBuilder;
      throw new Error(`Unexpected table ${table}`);
    });

    const result = await service.findOpenOrderByPhoneNumber('branch-1', '+998901234567');

    expect(result).toEqual(
      expect.objectContaining({
        id: 'order-invalid-recent',
      }),
    );
    expect(statusTypeConditionBuilder.orWhereRaw).toHaveBeenCalledWith(
      expect.stringContaining('ros.type = ?'),
      ['Invalid', 72],
    );
    expect(statusTypeConditionBuilder.orWhereRaw).toHaveBeenCalledWith(
      expect.stringContaining("NOW() - (? * INTERVAL '1 hour')"),
      ['Invalid', 72],
    );
  });

  it('counts null-typed workflow statuses as active when selecting the fallback telephony admin', async () => {
    const existingOrderBuilder = createBuilder();
    existingOrderBuilder.first.mockResolvedValue(undefined);

    const repairOrdersBuilder = createBuilder();
    repairOrdersBuilder.returning.mockResolvedValue([
      {
        id: 'order-1',
        number_id: 1,
        branch_id: 'branch-1',
        status_id: 'status-new',
        sort: 999999,
      },
    ]);

    const adminsBuilder = createBuilder();
    adminsBuilder.first.mockResolvedValue({ id: 'admin-least-busy' });

    const targetRolesBuilder = createBuilder();
    targetRolesBuilder.select.mockResolvedValue([{ role_id: 'role-1', role_name: 'Master' }]);

    const sharedRoleBuilder = createBuilder();
    sharedRoleBuilder.first.mockResolvedValue(undefined);

    const assignBuilder = createBuilder();

    const trx = jest.fn((table: string) => {
      if (table === 'repair_orders as ro') return existingOrderBuilder;
      if (table === 'repair_orders') return repairOrdersBuilder;
      if (table === 'admins') return adminsBuilder;
      if (table === 'admin_roles as ar') return targetRolesBuilder;
      if (table === 'repair_order_assign_admins as raa') return sharedRoleBuilder;
      if (table === 'repair_order_assign_admins') return assignBuilder;
      throw new Error(`Unexpected table ${table}`);
    }) as TransactionMock;

    trx.commit = jest.fn().mockResolvedValue(undefined);
    trx.rollback = jest.fn().mockResolvedValue(undefined);
    (trx as unknown as { raw: jest.Mock }).raw = jest.fn((sql: string, bindings?: unknown[]) => ({
      sql,
      bindings,
    }));

    knex.transaction.mockResolvedValue(trx);

    const workContextSpy = jest
      .spyOn(service as any, 'getCurrentWorkContext')
      .mockReturnValue({ currentDayStr: 'monday', currentHHmm: '10:00' });

    await service.createFromWebhook({
      userId: 'user-1',
      branchId: 'branch-1',
      statusId: 'status-new',
      phoneNumber: '+998901234567',
      source: 'Kiruvchi qongiroq',
      fallbackToFewestOpen: true,
    });

    expect(adminsBuilder.leftJoin).toHaveBeenCalledWith(
      'repair_order_statuses as ros',
      'ro.status_id',
      'ros.id',
    );
    expect(adminsBuilder.orderByRaw).toHaveBeenCalledWith(
      `COUNT(CASE WHEN ros.status = ? AND ros.is_active = true AND (ros.type IS NULL OR ros.type NOT IN (?, ?, ?, ?)) THEN 1 END) ASC`,
      ['Open', 'Cancelled', 'Canceled', 'Completed', 'Invalid'],
    );
    expect(adminsBuilder.andWhere).not.toHaveBeenCalledWith(
      'admins.work_start_time',
      '<=',
      expect.any(String),
    );
    expect(adminsBuilder.andWhere).not.toHaveBeenCalledWith(
      'admins.work_end_time',
      '>=',
      expect.any(String),
    );

    workContextSpy.mockRestore();
  });

  it('uses the telephony fallback assignment path for public open applications', async () => {
    const repairOrdersBuilder = createBuilder();
    repairOrdersBuilder.returning.mockResolvedValue([
      {
        id: 'order-open',
        number_id: 1001,
        user_id: 'user-1',
        branch_id: 'branch-1',
        status_id: 'status-open',
        sort: 999999,
      },
    ]);

    const trx = jest.fn((table: string) => {
      if (table === 'repair_orders') return repairOrdersBuilder;
      throw new Error(`Unexpected table ${table}`);
    }) as TransactionMock;

    trx.commit = jest.fn().mockResolvedValue(undefined);
    trx.rollback = jest.fn().mockResolvedValue(undefined);

    knex.transaction.mockResolvedValue(trx);

    jest
      .spyOn(service as any, 'resolveOpenApplicationBranchId')
      .mockResolvedValue('branch-1');
    jest.spyOn(service as any, 'resolveCreateStatus').mockResolvedValue({ id: 'status-open' });
    jest
      .spyOn(service as any, 'resolveOpenApplicationPhoneCategory')
      .mockResolvedValue({ customText: 'iPhone 13' });
    jest.spyOn(service as any, 'ensureUserByPhone').mockResolvedValue('user-1');
    jest.spyOn(service as any, 'recordOpenApplicationHistory').mockResolvedValue(undefined);
    const assignFallbackSpy = jest
      .spyOn(service as any, 'assignFallbackAdminIfOrderHasNone')
      .mockResolvedValue('admin-least-busy');

    await service.createOpenApplication({
      name: 'Test User',
      phone_number: '+998901234567',
      phone_category: 'iPhone 13',
      description: 'Screen broken',
    });

    expect(assignFallbackSpy).toHaveBeenCalledWith(trx, 'order-open', 'branch-1');
    expect((service as any).notifyRepairOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'order-open' }),
      expect.objectContaining({
        action: 'order_created',
        targetAdminId: 'admin-least-busy',
      }),
    );
  });

  it('assigns a fallback admin to an existing missed-call order with no assignees', async () => {
    const orderBuilder = createBuilder();
    orderBuilder.first.mockResolvedValue({
      id: 'order-1',
      number_id: 1,
      branch_id: 'branch-1',
      status: 'Open',
    });

    const assignBuilder = createBuilder();
    assignBuilder.first.mockResolvedValue(undefined);

    const adminsBuilder = createBuilder();
    adminsBuilder.first.mockResolvedValue({ id: 'admin-least-busy' });

    const targetRolesBuilder = createBuilder();
    targetRolesBuilder.select.mockResolvedValue([{ role_id: 'role-1', role_name: 'Master' }]);

    const sharedRoleBuilder = createBuilder();
    sharedRoleBuilder.first.mockResolvedValue(undefined);

    const trx = jest.fn((table: string) => {
      if (table === 'repair_orders') return orderBuilder;
      if (table === 'repair_order_assign_admins') return assignBuilder;
      if (table === 'admins') return adminsBuilder;
      if (table === 'admin_roles as ar') return targetRolesBuilder;
      if (table === 'repair_order_assign_admins as raa') return sharedRoleBuilder;
      throw new Error(`Unexpected table ${table}`);
    }) as TransactionMock;

    trx.commit = jest.fn().mockResolvedValue(undefined);
    trx.rollback = jest.fn().mockResolvedValue(undefined);
    (trx as unknown as { raw: jest.Mock }).raw = jest.fn((sql: string, bindings?: unknown[]) => ({
      sql,
      bindings,
    }));

    knex.transaction.mockResolvedValue(trx);

    const workContextSpy = jest
      .spyOn(service as any, 'getCurrentWorkContext')
      .mockReturnValue({ currentDayStr: 'monday', currentHHmm: '21:00' });

    await service.incrementMissedCallCount('order-1');

    expect(assignBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        repair_order_id: 'order-1',
        admin_id: 'admin-least-busy',
      }),
    );
    expect(adminsBuilder.andWhereRaw).toHaveBeenCalledWith(
      `(admins.work_days->>?)::boolean = true`,
      ['monday'],
    );
    expect(adminsBuilder.andWhere).not.toHaveBeenCalledWith(
      'admins.work_start_time',
      '<=',
      expect.any(String),
    );
    expect(adminsBuilder.andWhere).not.toHaveBeenCalledWith(
      'admins.work_end_time',
      '>=',
      expect.any(String),
    );

    workContextSpy.mockRestore();
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
