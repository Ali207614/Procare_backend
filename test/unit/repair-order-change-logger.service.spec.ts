import { RepairOrderChangeLoggerService } from '../../src/repair-orders/services/repair-order-change-logger.service';

describe('RepairOrderChangeLoggerService', () => {
  it('persists the system flag on repair-order history rows', async () => {
    const insertedHistory = {
      id: 'history-1',
      repair_order_id: 'order-1',
      field: 'status_id',
      old_value: '"status-old"',
      new_value: '"status-new"',
      created_by: 'admin-1',
      is_system: true,
      created_at: '2026-05-02T08:00:00.000Z',
    };

    const historyInsertBuilder = {
      insert: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([insertedHistory]),
    };

    const trx = jest.fn((table: string) => {
      if (table === 'repair_order_change_histories') {
        return historyInsertBuilder;
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const historyService = {
      createEvent: jest.fn().mockResolvedValue(undefined),
    };

    const service = new RepairOrderChangeLoggerService(
      jest.fn() as any,
      { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as any,
      historyService as any,
    );

    jest
      .spyOn((service as any).historyCommentManager, 'ensureCommentForHistory')
      .mockResolvedValue(true);

    await service.logIfChanged(
      trx as any,
      'order-1',
      'status_id',
      'status-old',
      'status-new',
      'admin-1',
      { isSystemActor: true },
    );

    expect(historyInsertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        repair_order_id: 'order-1',
        field: 'status_id',
        created_by: 'admin-1',
        is_system: true,
      }),
    );
  });
});
