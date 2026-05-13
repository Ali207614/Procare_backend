import { HistoryService } from './src/history/history.service';

describe('HistoryService Benchmark', () => {
  it('should run benchmark', async () => {
    let queries: any[] = [];
    const mockTrx = (query: string) => {
      queries.push(query);
      return {
        insert: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ id: '1' }]),
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        whereNotNull: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null),
      }
    };
    const mockKnex = Object.assign(mockTrx, {
      transaction: jest.fn(cb => cb(mockTrx))
    }) as any;

    const historyService = new (HistoryService as any)(mockKnex);

    const payload = {
      actionKey: 'test_action',
      actionKind: 'create' as any,
      sourceType: 'test_source',
      occurredAt: new Date(),
      entities: Array.from({ length: 50 }).map((_, i) => ({
        entityTable: 'users',
        entityPk: `user_${i}`,
        entityRole: 'created',
        key: `user_key_${i}`,
      })),
      actors: [
        {
          actorRole: 'initiator' as any,
          actorType: 'system',
        }
      ]
    };

    const start = Date.now();
    await historyService.createEvent(payload);
    const end = Date.now();

    console.log(`[BENCHMARK] Baseline Execution Time for 1 event with 50 entities: ${end - start} ms. Queries run: ${queries.length}`);
  });
});
