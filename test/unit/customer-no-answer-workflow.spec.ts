import { RepairOrdersService } from '../../src/repair-orders/repair-orders.service';
import { CustomerNoAnswerCronService } from '../../src/repair-orders/services/customer-no-answer-cron.service';
import { RepairOrder } from '../../src/common/types/repair-order.interface';

type Builder = {
  where: jest.Mock;
  andWhere: jest.Mock;
  andWhereRaw: jest.Mock;
  whereNotNull: jest.Mock;
  whereIn: jest.Mock;
  whereNull: jest.Mock;
  orWhereNotIn: jest.Mock;
  orWhereRaw: jest.Mock;
  first: jest.Mock;
  update: jest.Mock;
  decrement: jest.Mock;
  increment: jest.Mock;
  orderBy: jest.Mock;
  orderByRaw: jest.Mock;
  max: jest.Mock;
  select: jest.Mock;
  limit: jest.Mock;
  join: jest.Mock;
  leftJoin: jest.Mock;
};

const createBuilder = (
  options: {
    first?: unknown;
    max?: unknown;
    limit?: unknown;
  } = {},
): Builder => {
  const builder: Partial<Builder> = {};
  builder.where = jest.fn().mockReturnValue(builder);
  builder.andWhere = jest.fn().mockReturnValue(builder);
  builder.andWhereRaw = jest.fn().mockReturnValue(builder);
  builder.whereNotNull = jest.fn().mockReturnValue(builder);
  builder.whereIn = jest.fn().mockReturnValue(builder);
  builder.whereNull = jest.fn().mockReturnValue(builder);
  builder.orWhereNotIn = jest.fn().mockReturnValue(builder);
  builder.orWhereRaw = jest.fn().mockReturnValue(builder);
  builder.first = jest.fn().mockResolvedValue(options.first);
  builder.update = jest.fn().mockResolvedValue(1);
  builder.decrement = jest.fn().mockResolvedValue(1);
  builder.increment = jest.fn().mockResolvedValue(1);
  builder.orderBy = jest.fn().mockReturnValue(builder);
  builder.orderByRaw = jest.fn().mockReturnValue(builder);
  builder.max = jest.fn().mockResolvedValue(options.max ?? [{ maxSort: 0 }]);
  builder.select = jest.fn().mockReturnValue(builder);
  builder.limit = jest.fn().mockResolvedValue(options.limit ?? []);
  builder.join = jest.fn().mockReturnValue(builder);
  builder.leftJoin = jest.fn().mockReturnValue(builder);
  return builder as Builder;
};

type TransactionMock = jest.Mock & {
  commit: jest.Mock;
  rollback: jest.Mock;
};

const createService = (
  knex: jest.Mock & { transaction: jest.Mock; raw: jest.Mock },
  changeLogger = { logMultipleFieldsIfChanged: jest.fn().mockResolvedValue(undefined) },
) => {
  const service = new RepairOrdersService(
    knex as any,
    { findByRolesAndBranch: jest.fn(), checkPermissionsOrThrow: jest.fn() } as any,
    changeLogger as any,
    {} as any,
    {} as any,
    { getRepairOrderNotificationMeta: jest.fn().mockResolvedValue({ order_id: 'order-1' }) } as any,
    { flushByPrefix: jest.fn().mockResolvedValue(undefined) } as any,
    { log: jest.fn(), warn: jest.fn(), error: jest.fn() } as any,
    {} as any,
    { sendWebhook: jest.fn().mockResolvedValue(undefined) } as any,
    { notifyBranch: jest.fn().mockResolvedValue(undefined) } as any,
    { recordEntityCreated: jest.fn().mockResolvedValue(null) } as any,
  );

  jest.spyOn(service as any, 'notifyRepairOrderUpdate').mockResolvedValue(undefined);
  return service;
};

const baseOrder = {
  id: 'order-1',
  number_id: 101,
  branch_id: 'branch-1',
  user_id: 'user-1',
  status_id: 'status-open',
  status: 'Open',
  sort: 3,
  reject_cause_id: null,
  phone_number: '+998901234567',
  customer_no_answer_count: 0,
  customer_no_answer_due_at: null,
  last_customer_no_answer_at: null,
} as RepairOrder;

describe('RepairOrdersService customer no-answer workflow', () => {
  let knex: jest.Mock & { transaction: jest.Mock; raw: jest.Mock };
  let trx: TransactionMock;

  beforeEach(() => {
    knex = jest.fn() as jest.Mock & { transaction: jest.Mock; raw: jest.Mock };
    knex.raw = jest.fn();
    trx = jest.fn() as TransactionMock;
    trx.commit = jest.fn().mockResolvedValue(undefined);
    trx.rollback = jest.fn().mockResolvedValue(undefined);
    knex.transaction = jest.fn().mockResolvedValue(trx);
  });

  it('schedules the first three no-answer attempts for exactly 24 hours later', async () => {
    const occurredAt = new Date('2026-04-25T05:00:00.000Z');
    const orderBuilder = createBuilder({ first: baseOrder });
    const updateBuilder = createBuilder();
    const statusBuilder = createBuilder({ first: { id: 'status-open', type: 'Open' } });

    trx.mockImplementation((table: string) => {
      if (table === 'repair_orders') {
        return orderBuilder.first.mock.calls.length === 0 ? orderBuilder : updateBuilder;
      }
      if (table === 'repair_order_statuses') return statusBuilder;
      throw new Error(`Unexpected table ${table}`);
    });

    const service = createService(knex);

    await service.recordCustomerNoAnswer(baseOrder.id, occurredAt);

    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_no_answer_count: 1,
        last_customer_no_answer_at: occurredAt,
        customer_no_answer_due_at: new Date('2026-04-26T05:00:00.000Z'),
      }),
    );
    expect(trx.commit).toHaveBeenCalled();
  });

  it('moves to Invalid immediately on the fourth consecutive no-answer', async () => {
    const occurredAt = new Date('2026-04-25T05:00:00.000Z');
    const order = { ...baseOrder, customer_no_answer_count: 3 };
    const orderBuilder = createBuilder({ first: order });
    const oldSortBuilder = createBuilder();
    const newSortBuilder = createBuilder();
    const updateBuilder = createBuilder();
    const currentStatusBuilder = createBuilder({ first: { id: 'status-open', type: 'Open' } });
    const invalidStatusBuilder = createBuilder({
      first: { id: 'status-invalid', type: 'Invalid' },
    });
    const rejectCauseBuilder = createBuilder({ first: { id: 'reject-no-answer' } });
    const adminBuilder = createBuilder({ first: { id: 'system-admin' } });

    const repairOrderBuilders = [orderBuilder, oldSortBuilder, newSortBuilder, updateBuilder];
    const statusBuilders = [currentStatusBuilder, invalidStatusBuilder];

    trx.mockImplementation((table: string) => {
      if (table === 'repair_orders') return repairOrderBuilders.shift();
      if (table === 'repair_order_statuses') return statusBuilders.shift();
      if (table === 'repair_order_reject_causes') return rejectCauseBuilder;
      if (table === 'admins') return adminBuilder;
      throw new Error(`Unexpected table ${table}`);
    });

    const changeLogger = { logMultipleFieldsIfChanged: jest.fn().mockResolvedValue(undefined) };
    const service = createService(knex, changeLogger);

    await service.recordCustomerNoAnswer(order.id, occurredAt);

    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status_id: 'status-invalid',
        sort: 1,
        reject_cause_id: 'reject-no-answer',
        customer_no_answer_count: 4,
        customer_no_answer_due_at: null,
      }),
    );
    expect(changeLogger.logMultipleFieldsIfChanged).toHaveBeenCalled();
    expect(trx.commit).toHaveBeenCalled();
  });

  it('resets no-answer tracking when the customer answers', async () => {
    const order = {
      ...baseOrder,
      customer_no_answer_count: 2,
      last_customer_no_answer_at: '2026-04-25T05:00:00.000Z',
      customer_no_answer_due_at: '2026-04-26T05:00:00.000Z',
    };
    const workflowQuery = createBuilder({ first: order });
    const updateBuilder = createBuilder();

    trx.mockImplementation((table: string) => {
      if (table === 'repair_orders') return updateBuilder;
      throw new Error(`Unexpected table ${table}`);
    });

    const service = createService(knex);
    jest
      .spyOn(service as any, 'buildTelephonyWorkflowOpenOrderQuery')
      .mockReturnValue(workflowQuery);
    jest.spyOn(service as any, 'resolveWebhookAdminId').mockResolvedValue(null);
    jest.spyOn(service as any, 'moveToTop').mockResolvedValue(undefined);

    await service.handleCallAnswered({
      branchId: 'branch-1',
      phoneNumber: '+998901234567',
      onlinepbxCode: '120',
      userId: 'user-1',
      source: 'Chiquvchi qongiroq',
    });

    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_no_answer_count: 0,
        last_customer_no_answer_at: null,
        customer_no_answer_due_at: null,
      }),
    );
  });

  it('moves a due order to Missed and clears the pending timestamp', async () => {
    const order = {
      ...baseOrder,
      customer_no_answer_count: 2,
      customer_no_answer_due_at: '2026-04-25T05:00:00.000Z',
    };
    const orderBuilder = createBuilder({ first: order });
    const oldSortBuilder = createBuilder();
    const newSortBuilder = createBuilder();
    const updateBuilder = createBuilder();
    const currentStatusBuilder = createBuilder({ first: { id: 'status-open', type: 'Open' } });
    const missedStatusBuilder = createBuilder({ first: { id: 'status-missed', type: 'Missed' } });
    const adminBuilder = createBuilder({ first: { id: 'system-admin' } });

    const repairOrderBuilders = [orderBuilder, oldSortBuilder, newSortBuilder, updateBuilder];
    const statusBuilders = [currentStatusBuilder, missedStatusBuilder];

    trx.mockImplementation((table: string) => {
      if (table === 'repair_orders') return repairOrderBuilders.shift();
      if (table === 'repair_order_statuses') return statusBuilders.shift();
      if (table === 'admins') return adminBuilder;
      throw new Error(`Unexpected table ${table}`);
    });

    const service = createService(knex);

    await service.processDueCustomerNoAnswer(order.id);

    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status_id: 'status-missed',
        sort: 1,
        customer_no_answer_due_at: null,
      }),
    );
    expect(trx.commit).toHaveBeenCalled();
  });
});

describe('CustomerNoAnswerCronService', () => {
  it('dispatches due no-answer repair orders to the repair order service', async () => {
    const queryBuilder = createBuilder({
      limit: [{ id: 'order-1' }, { id: 'order-2' }],
    });
    const knex = jest.fn((table: string) => {
      if (table === 'repair_orders') return queryBuilder;
      throw new Error(`Unexpected table ${table}`);
    }) as jest.Mock & { fn: { now: jest.Mock } };
    knex.fn = { now: jest.fn(() => 'now()') };

    const repairOrdersService = {
      processDueCustomerNoAnswer: jest.fn().mockResolvedValue(undefined),
    };
    const logger = { log: jest.fn(), error: jest.fn() };

    const service = new CustomerNoAnswerCronService(
      knex as any,
      logger as any,
      repairOrdersService as any,
    );

    await service.handleDueCustomerNoAnswers();

    expect(repairOrdersService.processDueCustomerNoAnswer).toHaveBeenCalledTimes(2);
    expect(repairOrdersService.processDueCustomerNoAnswer).toHaveBeenCalledWith('order-1');
    expect(repairOrdersService.processDueCustomerNoAnswer).toHaveBeenCalledWith('order-2');
  });
});
