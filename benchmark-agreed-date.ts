import { AgreedDateCronService } from './src/repair-orders/services/agreed-date-cron.service';
import { LoggerService } from './src/common/logger/logger.service';
import { NotificationGateway } from './src/notification/notification.gateway';
import { RepairOrderCreateHelperService } from './src/repair-orders/services/repair-order-create-helper.service';
import { RedisService } from './src/common/redis/redis.service';
import { Knex } from 'knex';
import { RepairOrder } from './src/common/types/repair-order.interface';

async function runBenchmark() {
  const NUM_ORDERS = 100;

  // Mock data
  const statusIds = [{ status_id: 'status-1' }];
  const matchingOrders: RepairOrder[] = Array.from({ length: NUM_ORDERS }).map((_, i) => ({
    id: `order-${i}`,
    branch_id: `branch-${i % 5}`,
    status_id: 'status-1',
    status: 'Open',
    sort: i + 2, // ensure moveToTop is called
    number_id: 1000 + i,
  } as unknown as RepairOrder));

  // Mock dependencies
  const mockLogger = {
    log: () => {},
    error: () => {},
  } as unknown as LoggerService;

  const mockGateway = {
    broadcastToBranch: () => {},
  } as unknown as NotificationGateway;

  const mockHelper = {
    getRepairOrderNotificationMeta: async () => {
      await new Promise(resolve => setTimeout(resolve, 5)); // Simulate DB latency
      return { some: 'meta' };
    },
  } as unknown as RepairOrderCreateHelperService;

  const mockRedisService = {
    flushByPrefix: async () => {
      await new Promise(resolve => setTimeout(resolve, 2));
    },
  } as unknown as RedisService;

  const mockTrx = Object.assign(() => ({
    where: () => ({
      andWhere: () => ({
        increment: async () => {
          await new Promise(resolve => setTimeout(resolve, 5));
        },
      }),
    }),
    update: async () => {
      await new Promise(resolve => setTimeout(resolve, 5));
    },
  }), {
    commit: async () => {
      await new Promise(resolve => setTimeout(resolve, 2));
    },
    rollback: async () => {},
  });

  const mockKnex = Object.assign(() => ({
    where: () => ({
      distinct: () => ({
        select: async () => statusIds,
      }),
    }),
    whereIn: () => ({
      andWhere: () => ({
        whereNotNull: () => ({
          andWhere: () => ({
            andWhere: async () => matchingOrders,
          }),
        }),
      }),
    }),
  }), {
    transaction: async () => {
      await new Promise(resolve => setTimeout(resolve, 2));
      return mockTrx;
    },
  }) as unknown as Knex;

  const service = new AgreedDateCronService(
    mockKnex,
    mockLogger,
    mockGateway,
    mockHelper,
    mockRedisService,
  );

  console.log('Starting benchmark...');
  const start = performance.now();

  await service.handleAgreedDateTrigger();

  const end = performance.now();
  console.log(`Benchmark completed in ${(end - start).toFixed(2)} ms for ${NUM_ORDERS} orders.`);
}

runBenchmark().catch(console.error);
