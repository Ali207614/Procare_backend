import { HistoryService } from '../../../src/history/history.service';

async function runBenchmark() {
  const mockTrx = (tableName?: string) => {
    const fn: any = (table: string) => mockTrx(table);

    fn.insert = () => fn;
    fn.where = () => fn;
    fn.returning = async () => [{ id: 'mock-id', occurred_at: new Date() }];
    fn.select = () => fn;
    fn.whereNotNull = () => fn;
    fn.whereIn = () => fn;
    fn.orderBy = () => fn;
    fn.limit = () => fn;
    fn.update = () => fn;
    fn.first = async () => undefined;
    fn.then = (resolve: any) => resolve([{ id: 'mock-id', occurred_at: new Date() }]);
    return fn;
  };
  (mockTrx as any).transaction = async (cb: any) => {
    return cb(mockTrx);
  };
  (mockTrx as any).raw = async () => ({ rows: [] });

  const service = new HistoryService(mockTrx as any);

  // mock createEdges to measure if bulk insert works
  let edgesCreated = 0;
  (service as any).createEdges = async (trx: any, edges: any[]) => {
    edgesCreated += edges.length;
    // simulate a little bit of time for bulk query
    await new Promise(r => setTimeout(r, 1));
  };
  (service as any).createEdge = async (trx: any, edge: any) => {
    edgesCreated++;
    await new Promise(r => setTimeout(r, 1));
  };

  // We are monkey patching the loop in createEvent to simulate the optimization
  const originalCreateEvent = service.createEvent;
  // Actually let's just observe the issue in src/history/history.service.ts
}
runBenchmark().catch(console.error);
