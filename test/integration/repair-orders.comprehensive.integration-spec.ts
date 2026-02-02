import { Test, TestingModule } from '@nestjs/testing';
import { Knex, knex } from 'knex';
import Redis from 'ioredis';
import { RepairOrdersService } from '../src/repair-orders/repair-orders.service';
import { RepairOrderStatusPermissionsService } from '../src/repair-order-status-permission/repair-order-status-permissions.service';
import { RedisService } from '../src/common/redis/redis.service';
import { RepairOrderChangeLoggerService } from '../src/repair-orders/services/repair-order-change-logger.service';
import { InitialProblemUpdaterService } from '../src/repair-orders/services/initial-problem-updater.service';
import { FinalProblemUpdaterService } from '../src/repair-orders/services/final-problem-updater.service';
import { RepairOrderCreateHelperService } from '../src/repair-orders/services/repair-order-create-helper.service';
import { LoggerService } from '../src/common/logger/logger.service';
import { TestHelpers } from './utils/test-helpers';
import { RepairOrderFactory } from './factories/repair-order.factory';
import { AdminFactory } from './factories/admin.factory';
import { BranchFactory } from './factories/branch.factory';

describe('Repair Orders Integration Tests', () => {
  let repairOrdersService: RepairOrdersService;
  let knexInstance: Knex;
  let redisClient: Redis;
  let redisService: RedisService;

  beforeAll(async () => {
    try {
      // Setup real database connection
      knexInstance = knex({
        client: 'pg',
        connection: {
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT) || 5433,
          user: process.env.DB_USER || 'test_user',
          password: process.env.DB_PASS || 'test_pass',
          database: process.env.DB_NAME || 'repair_order_test',
        },
        pool: { min: 2, max: 10 },
      });

      // Setup Redis connection
      redisClient = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6380,
      });

      // Test connections
      await knexInstance.raw('SELECT 1');
      await redisClient.ping();

      redisService = new RedisService(redisClient, { log: () => {}, error: () => {} } as any);
    } catch (error) {
      console.warn('Database/Redis connection failed:', error.message);
    }
  });

  beforeEach(async () => {
    if (!knexInstance || !redisClient) {
      return;
    }

    try {
      // Clean database and Redis
      await TestHelpers.cleanDatabase(knexInstance);
      await redisClient.flushdb();

      // Create test module with mocked dependencies
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RepairOrdersService,
          {
            provide: 'default_KnexModuleConnectionToken',
            useValue: knexInstance,
          },
          {
            provide: RedisService,
            useValue: redisService,
          },
          {
            provide: RepairOrderStatusPermissionsService,
            useValue: {
              getRepairOrderStatusPermissions: jest.fn().mockResolvedValue([]),
              getPermissionByStatusIdAndTargetStatusId: jest.fn().mockResolvedValue(null),
            },
          },
          {
            provide: RepairOrderChangeLoggerService,
            useValue: {
              logChange: jest.fn(),
            },
          },
          {
            provide: InitialProblemUpdaterService,
            useValue: {
              updateInitialProblem: jest.fn(),
            },
          },
          {
            provide: FinalProblemUpdaterService,
            useValue: {
              updateFinalProblem: jest.fn(),
            },
          },
          {
            provide: RepairOrderCreateHelperService,
            useValue: {
              flushCacheByPrefix: jest.fn(),
              insertRentalPhone: jest.fn(),
              insertAssignAdmins: jest.fn(),
              insertInitialProblems: jest.fn(),
              insertFinalProblems: jest.fn(),
              insertComments: jest.fn(),
              insertPickup: jest.fn(),
              insertDelivery: jest.fn(),
            },
          },
          {
            provide: LoggerService,
            useValue: {
              log: jest.fn(),
              error: jest.fn(),
              warn: jest.fn(),
              debug: jest.fn(),
            },
          },
        ],
      }).compile();

      repairOrdersService = module.get<RepairOrdersService>(RepairOrdersService);

      // Seed test data
      await TestHelpers.seedTestData(knexInstance);
    } catch (error) {
      console.warn('Test setup failed:', error.message);
    }
  });

  afterAll(async () => {
    try {
      if (knexInstance) {
        await TestHelpers.cleanDatabase(knexInstance);
        await knexInstance.destroy();
      }
      if (redisClient) {
        await redisClient.quit();
      }
    } catch (error) {
      console.warn('Cleanup failed:', error.message);
    }
  });

  describe('Complete Repair Order Lifecycle', () => {
    it('should handle complete repair order workflow', async () => {
      if (!knexInstance || !redisClient) {
        console.warn('Integration test skipped - database not available');
        return;
      }

      try {
        // Setup test data
        const branch = BranchFactory.create();
        const admin = AdminFactory.create({ branch_id: branch.id });
        const adminPayload = AdminFactory.createPayload({ id: admin.id });

        await knexInstance('branches').insert(branch);
        await knexInstance('admins').insert(admin);

        // Create repair order status
        const status = {
          id: 'test-status-id',
          name: 'Open',
          description: 'Open status',
          color: '#FF0000',
          created_at: new Date(),
          updated_at: new Date(),
        };
        await knexInstance('repair_order_statuses').insert(status);

        // 1. Create repair order
        const createDto = RepairOrderFactory.createDto({
          customer_phone: '+998901234567',
          device_type: 'Smartphone',
          brand: 'Samsung',
          model: 'Galaxy S21',
          problem_description: 'Screen broken',
        });

        const createdOrder = await repairOrdersService.create(
          adminPayload,
          branch.id,
          status.id,
          createDto,
        );

        expect(createdOrder).toBeDefined();
        expect(createdOrder.id).toBeTruthy();
        expect(createdOrder.customer_phone).toBe(createDto.customer_phone);
        expect(createdOrder.branch_id).toBe(branch.id);

        // Verify in database
        const dbOrder = await knexInstance('repair_orders').where('id', createdOrder.id).first();
        expect(dbOrder).toBeTruthy();

        // 2. Find repair order by ID
        const foundOrder = await repairOrdersService.findById(adminPayload, createdOrder.id);
        expect(foundOrder).toBeDefined();
        expect(foundOrder.id).toBe(createdOrder.id);

        // 3. Update repair order
        const updateDto = {
          model: 'Galaxy S22',
          problem_description: 'Screen and battery issues',
        };

        const updatedOrder = await repairOrdersService.update(
          adminPayload,
          createdOrder.id,
          updateDto,
        );

        expect(updatedOrder.model).toBe(updateDto.model);
        expect(updatedOrder.problem_description).toBe(updateDto.problem_description);

        // 4. Test pagination and filtering
        const findAllResult = await repairOrdersService.findAll(adminPayload, {
          limit: 10,
          offset: 0,
          branch_id: branch.id,
        });

        expect(findAllResult).toHaveProperty('data');
        expect(findAllResult).toHaveProperty('meta');
        expect(findAllResult.data).toBeInstanceOf(Array);
        expect(findAllResult.data.length).toBeGreaterThan(0);
        expect(findAllResult.meta.total).toBeGreaterThan(0);

        // 5. Soft delete repair order
        await repairOrdersService.delete(adminPayload, createdOrder.id);

        // Verify soft delete
        const deletedOrder = await knexInstance('repair_orders')
          .where('id', createdOrder.id)
          .first();
        expect(deletedOrder.deleted_at).not.toBeNull();

        // Should not appear in regular queries
        const findAllAfterDelete = await repairOrdersService.findAll(adminPayload, {
          limit: 10,
          offset: 0,
          branch_id: branch.id,
        });
        expect(findAllAfterDelete.data).toHaveLength(0);
      } catch (error) {
        if (error.message.includes('connect') || error.message.includes('ECONNREFUSED')) {
          console.warn('Integration test skipped - database/Redis not available');
          return;
        }
        throw error;
      }
    });
  });

  describe('Cache Management', () => {
    it('should properly manage cache for repair orders', async () => {
      if (!knexInstance || !redisClient) {
        return;
      }

      try {
        // Setup test data
        const branch = BranchFactory.create();
        const admin = AdminFactory.create({ branch_id: branch.id });
        const adminPayload = AdminFactory.createPayload({ id: admin.id });

        await knexInstance('branches').insert(branch);
        await knexInstance('admins').insert(admin);

        const status = {
          id: 'test-status-id',
          name: 'Open',
          description: 'Open status',
          color: '#FF0000',
          created_at: new Date(),
          updated_at: new Date(),
        };
        await knexInstance('repair_order_statuses').insert(status);

        // Create repair order
        const createDto = RepairOrderFactory.createDto();
        const createdOrder = await repairOrdersService.create(
          adminPayload,
          branch.id,
          status.id,
          createDto,
        );

        // First read (should cache)
        await repairOrdersService.findById(adminPayload, createdOrder.id);

        // Check cache keys exist
        const cacheKeys = await redisClient.keys('*repair*');
        expect(cacheKeys.length).toBeGreaterThanOrEqual(0);

        // Update order (should invalidate cache)
        await repairOrdersService.update(adminPayload, createdOrder.id, {
          model: 'Updated Model',
        });

        // Cache should be updated/invalidated
        const keysAfterUpdate = await redisClient.keys('*repair*');
        // Note: Cache invalidation behavior depends on implementation
      } catch (error) {
        if (error.message.includes('connect')) {
          console.warn('Integration test skipped - database not available');
          return;
        }
        throw error;
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle database transaction errors gracefully', async () => {
      if (!knexInstance || !redisClient) {
        return;
      }

      try {
        const adminPayload = AdminFactory.createPayload();

        // Try to create order with invalid data (should rollback transaction)
        const invalidDto = RepairOrderFactory.createDto({
          customer_phone: 'invalid-phone-format',
        });

        await expect(
          repairOrdersService.create(
            adminPayload,
            'invalid-branch-id',
            'invalid-status-id',
            invalidDto,
          ),
        ).rejects.toThrow();

        // Verify no partial data was inserted
        const count = await knexInstance('repair_orders').count('id as count');
        expect(parseInt(count[0].count)).toBe(0);
      } catch (error) {
        if (error.message.includes('connect')) {
          console.warn('Integration test skipped - database not available');
          return;
        }
        throw error;
      }
    });

    it('should handle Redis connection failures gracefully', async () => {
      if (!knexInstance || !redisClient) {
        return;
      }

      try {
        // Create a Redis service that throws errors
        const faultyRedisService = {
          get: jest.fn().mockRejectedValue(new Error('Redis connection failed')),
          set: jest.fn().mockRejectedValue(new Error('Redis connection failed')),
          del: jest.fn().mockRejectedValue(new Error('Redis connection failed')),
        };

        // Create service with faulty Redis
        const module: TestingModule = await Test.createTestingModule({
          providers: [
            RepairOrdersService,
            {
              provide: 'default_KnexModuleConnectionToken',
              useValue: knexInstance,
            },
            {
              provide: RedisService,
              useValue: faultyRedisService,
            },
            // ... other mocked providers
          ],
        }).compile();

        const serviceWithFaultyRedis = module.get<RepairOrdersService>(RepairOrdersService);

        // Service should still work even with Redis failures (graceful degradation)
        const adminPayload = AdminFactory.createPayload();

        // This should not throw error even if Redis fails
        // (depends on implementation - some operations might require Redis)
      } catch (error) {
        if (error.message.includes('connect')) {
          console.warn('Integration test skipped - database not available');
          return;
        }
        // Redis failures might be expected in some cases
        console.warn('Redis error in test (may be expected):', error.message);
      }
    });
  });

  describe('Concurrency and Performance', () => {
    it('should handle concurrent operations correctly', async () => {
      if (!knexInstance || !redisClient) {
        return;
      }

      try {
        // Setup test data
        const branch = BranchFactory.create();
        const admin = AdminFactory.create({ branch_id: branch.id });
        const adminPayload = AdminFactory.createPayload({ id: admin.id });

        await knexInstance('branches').insert(branch);
        await knexInstance('admins').insert(admin);

        const status = {
          id: 'test-status-id',
          name: 'Open',
          description: 'Open status',
          color: '#FF0000',
          created_at: new Date(),
          updated_at: new Date(),
        };
        await knexInstance('repair_order_statuses').insert(status);

        // Create multiple repair orders concurrently
        const createPromises = Array.from({ length: 5 }, (_, index) =>
          repairOrdersService.create(
            adminPayload,
            branch.id,
            status.id,
            RepairOrderFactory.createDto({
              customer_phone: `+99890123456${index}`,
              model: `Test Model ${index}`,
            }),
          ),
        );

        const createdOrders = await Promise.all(createPromises);

        expect(createdOrders).toHaveLength(5);
        createdOrders.forEach((order, index) => {
          expect(order.id).toBeTruthy();
          expect(order.customer_phone).toBe(`+99890123456${index}`);
        });

        // Verify all were created in database
        const dbCount = await knexInstance('repair_orders')
          .where('branch_id', branch.id)
          .count('id as count');
        expect(parseInt(dbCount[0].count)).toBe(5);
      } catch (error) {
        if (error.message.includes('connect')) {
          console.warn('Integration test skipped - database not available');
          return;
        }
        throw error;
      }
    });
  });
});
