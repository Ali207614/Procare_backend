import { RepairOrdersService } from '../../src/repair-orders/repair-orders.service';

type Builder = {
  where: jest.Mock;
  first: jest.Mock;
  insert: jest.Mock;
  returning: jest.Mock;
  update: jest.Mock;
  join: jest.Mock;
  select: jest.Mock;
  onConflict: jest.Mock;
  ignore: jest.Mock;
};

const createBuilder = (): Builder => {
  const builder: Partial<Builder> = {};
  builder.where = jest.fn().mockReturnValue(builder);
  builder.first = jest.fn();
  builder.insert = jest.fn().mockReturnValue(builder);
  builder.returning = jest.fn();
  builder.update = jest.fn().mockResolvedValue(undefined);
  builder.join = jest.fn().mockReturnValue(builder);
  builder.select = jest.fn().mockReturnValue(builder);
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
      { notifyBranch: jest.fn(), notifyAdmins: jest.fn() } as any,
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

    const assignBuilder = createBuilder();

    const trx = jest.fn((table: string) => {
      if (table === 'repair_orders') return repairOrdersBuilder;
      if (table === 'admins as a') return adminsBuilder;
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

    const assignBuilder = createBuilder();

    const trx = jest.fn((table: string) => {
      if (table === 'repair_orders') return orderBuilder;
      if (table === 'admins as a') return adminsBuilder;
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
});
