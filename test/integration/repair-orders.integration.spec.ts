import { Test, TestingModule } from '@nestjs/testing';
import { RepairOrdersService } from '../../src/repair-orders/repair-orders.service';
import { Knex, knex } from 'knex';
import { getKnexToken } from 'nestjs-knex';
import { RedisService } from '../../src/common/redis/redis.service';
import { RepairOrderStatusPermissionsService } from '../../src/repair-order-status-permission/repair-order-status-permissions.service';
import { RepairOrderChangeLoggerService } from './services/repair-order-change-logger.service';
import { InitialProblemUpdaterService } from './services/initial-problem-updater.service';
import { FinalProblemUpdaterService } from './services/final-problem-updater.service';
import { RepairOrderCreateHelperService } from './services/repair-order-create-helper.service';
import { LoggerService } from '../../src/common/logger/logger.service';
import { CreateRepairOrderDto } from '../../src/create-repair-order.dto';
import { AdminPayload } from '../../src/common/types/admin-payload.interface';
import { RepairOrder } from '../../src/common/types/repair-order.interface';
import { TestHelpers, MockFactory } from '../../src/../test/utils/test-helpers';
import IORedis from 'ioredis';

describe('RepairOrdersService Integration Tests', () => {
  let service: RepairOrdersService;
  let knexInstance: Knex;
  let redisClient: IORedis;
  let testData: {
    branch: any;
    role: any;
    admin: any;
    user: any;
    phoneCategory: any;
    status: any;
    permissions: any[];
  };

  // Mock services that don't need real integration
  const mockPermissionService = {
    findByRolesAndBranch: jest.fn(),
    checkPermissionsOrThrow: jest.fn(),
  };

  const mockChangeLogger = {
    logChange: jest.fn(),
  };

  const mockInitialProblemUpdater = {
    update: jest.fn(),
  };

  const mockFinalProblemUpdater = {
    update: jest.fn(),
  };

  const mockHelper = {
    insertAssignAdmins: jest.fn().mockResolvedValue(undefined),
    insertRentalPhone: jest.fn().mockResolvedValue(undefined),
    insertInitialProblems: jest.fn().mockResolvedValue(undefined),
    insertFinalProblems: jest.fn().mockResolvedValue(undefined),
    insertComments: jest.fn().mockResolvedValue(undefined),
    insertPickup: jest.fn().mockResolvedValue(undefined),
    insertDelivery: jest.fn().mockResolvedValue(undefined),
  };

  const mockLogger = {
    error: jest.fn(),
    log: jest.fn(),
  };

  beforeAll(async () => {
    // Setup real database connection for testing
    knexInstance = knex({
      client: 'pg',
      connection: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5433,
        user: process.env.DB_USER || 'test_user',
        password: process.env.DB_PASS || 'test_pass',
        database: process.env.DB_NAME || 'procare_test',
      },
      pool: { min: 2, max: 10 },
      migrations: {
        directory: './migrations',
      },
    });

    // Setup Redis connection
    redisClient = new IORedis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6380,
      retryDelayOnFailover: 100,
      lazyConnect: true,
    });

    try {
      await redisClient.connect();
    } catch (error) {
      console.warn('Redis connection failed in tests, using mock');
    }

    // Setup module
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepairOrdersService,
        {
          provide: getKnexToken(),
          useValue: knexInstance,
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            flushByPrefix: jest.fn(),
          },
        },
        {
          provide: RepairOrderStatusPermissionsService,
          useValue: mockPermissionService,
        },
        {
          provide: RepairOrderChangeLoggerService,
          useValue: mockChangeLogger,
        },
        {
          provide: InitialProblemUpdaterService,
          useValue: mockInitialProblemUpdater,
        },
        {
          provide: FinalProblemUpdaterService,
          useValue: mockFinalProblemUpdater,
        },
        {
          provide: RepairOrderCreateHelperService,
          useValue: mockHelper,
        },
        {
          provide: LoggerService,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<RepairOrdersService>(RepairOrdersService);
  });

  beforeEach(async () => {
    // Clean database and seed test data
    await TestHelpers.cleanDatabase(knexInstance);
    const seedData = await TestHelpers.seedTestData(knexInstance);

    // Create additional test data
    const [user] = await knexInstance('users')
      .insert({
        id: MockFactory.createAdmin().id,
        phone: '+998901234568',
        status: 'Open',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    const [phoneCategory] = await knexInstance('phone_categories')
      .insert({
        id: MockFactory.createAdmin().id,
        name: 'iPhone',
        is_active: true,
        status: 'Open',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    const [status] = await knexInstance('statuses')
      .insert({
        id: MockFactory.createAdmin().id,
        name: 'Open',
        branch_id: seedData.branch.id,
        is_active: true,
        status: 'Open',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    const permissions = [
      {
        role_id: seedData.role.id,
        branch_id: seedData.branch.id,
        status_id: status.id,
        can_add: true,
        can_edit: true,
        can_view: true,
        can_delete: true,
      },
    ];

    testData = {
      ...seedData,
      user,
      phoneCategory,
      status,
      permissions,
    };

    // Setup mock responses
    mockPermissionService.findByRolesAndBranch.mockResolvedValue(permissions);
    mockPermissionService.checkPermissionsOrThrow.mockResolvedValue(undefined);
  });

  afterAll(async () => {
    // Cleanup
    await TestHelpers.cleanDatabase(knexInstance);
    await knexInstance.destroy();
    if (redisClient.status === 'ready') {
      await redisClient.quit();
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Full CRUD Operations', () => {
    it('should perform complete repair order lifecycle with database', async () => {
      // Arrange
      const adminPayload: AdminPayload = {
        id: testData.admin.id,
        phone: testData.admin.phone,
        full_name: testData.admin.full_name,
        roles: [testData.role.id],
      };

      const createDto: CreateRepairOrderDto = {
        user_id: testData.user.id,
        phone_category_id: testData.phoneCategory.id,
        status_id: testData.status.id,
        priority: 'High',
      };

      // Act & Assert

      // 1. Create repair order
      const created = await service.create(
        adminPayload,
        testData.branch.id,
        testData.status.id,
        createDto,
      );

      expect(created.id).toBeDefined();
      expect(created.user_id).toBe(createDto.user_id);
      expect(created.priority).toBe('High');
      expect(created.status_id).toBe(testData.status.id);

      // Verify data was actually inserted into database
      const dbRecord = await knexInstance('repair_orders')
        .where('id', created.id)
        .first();
      expect(dbRecord).toBeDefined();
      expect(dbRecord.user_id).toBe(createDto.user_id);

      // 2. Find by ID
      const found = await service.findById(adminPayload, created.id);
      expect(found.id).toBe(created.id);
      expect(found.user_id).toBe(createDto.user_id);

      // 3. Test findAll functionality
      const allResults = await service.findAllByAdminBranch(
        adminPayload,
        testData.branch.id,
        { limit: 10, offset: 0 },
      );
      expect(allResults).toBeDefined();

      // 4. Update repair order
      const updateResult = await service.update(adminPayload, created.id, {
        priority: 'Low',
      });
      expect(updateResult.message).toContain('successfully');

      // Verify update in database
      const updatedRecord = await knexInstance('repair_orders')
        .where('id', created.id)
        .first();
      expect(updatedRecord.priority).toBe('Low');

      // 5. Soft delete
      const deleteResult = await service.softDelete(adminPayload, created.id);
      expect(deleteResult.message).toContain('successfully');

      // Verify soft delete
      const deletedRecord = await knexInstance('repair_orders')
        .where('id', created.id)
        .first();
      expect(deletedRecord.deleted_at).not.toBeNull();
    });
  });

  describe('Database Constraints and Validations', () => {
    it('should handle foreign key constraint violations', async () => {
      // Arrange
      const adminPayload: AdminPayload = {
        id: testData.admin.id,
        phone: testData.admin.phone,
        full_name: testData.admin.full_name,
        roles: [testData.role.id],
      };

      const invalidCreateDto: CreateRepairOrderDto = {
        user_id: 'non-existent-user-id', // This should cause a foreign key error
        phone_category_id: testData.phoneCategory.id,
        status_id: testData.status.id,
      };

      // Act & Assert
      await expect(
        service.create(
          adminPayload,
          testData.branch.id,
          testData.status.id,
          invalidCreateDto,
        ),
      ).rejects.toThrow(); // Should fail due to foreign key constraint
    });

    it('should handle duplicate entries correctly', async () => {
      // This test would depend on your specific business logic
      // For example, if you have unique constraints on certain combinations
      const adminPayload: AdminPayload = {
        id: testData.admin.id,
        phone: testData.admin.phone,
        full_name: testData.admin.full_name,
        roles: [testData.role.id],
      };

      const createDto: CreateRepairOrderDto = {
        user_id: testData.user.id,
        phone_category_id: testData.phoneCategory.id,
        status_id: testData.status.id,
      };

      // Create first order
      const first = await service.create(
        adminPayload,
        testData.branch.id,
        testData.status.id,
        createDto,
      );

      // Create second order with same data (should succeed as repair orders can duplicate)
      const second = await service.create(
        adminPayload,
        testData.branch.id,
        testData.status.id,
        createDto,
      );

      expect(first.id).not.toBe(second.id);
      expect(first.sort).not.toBe(second.sort); // Sort values should be different
    });
  });

  describe('Transaction Handling', () => {
    it('should rollback transaction on helper service failure', async () => {
      // Arrange
      const adminPayload: AdminPayload = {
        id: testData.admin.id,
        phone: testData.admin.phone,
        full_name: testData.admin.full_name,
        roles: [testData.role.id],
      };

      const createDto: CreateRepairOrderDto = {
        user_id: testData.user.id,
        phone_category_id: testData.phoneCategory.id,
        status_id: testData.status.id,
      };

      // Make one of the helper methods fail
      mockHelper.insertComments.mockRejectedValueOnce(new Error('Helper service error'));

      // Act & Assert
      await expect(
        service.create(
          adminPayload,
          testData.branch.id,
          testData.status.id,
          createDto,
        ),
      ).rejects.toThrow('Helper service error');

      // Verify no repair order was created due to transaction rollback
      const records = await knexInstance('repair_orders')
        .where('user_id', createDto.user_id);
      expect(records).toHaveLength(0);
    });

    it('should commit transaction when all operations succeed', async () => {
      // Arrange
      const adminPayload: AdminPayload = {
        id: testData.admin.id,
        phone: testData.admin.phone,
        full_name: testData.admin.full_name,
        roles: [testData.role.id],
      };

      const createDto: CreateRepairOrderDto = {
        user_id: testData.user.id,
        phone_category_id: testData.phoneCategory.id,
        status_id: testData.status.id,
      };

      // Act
      const result = await service.create(
        adminPayload,
        testData.branch.id,
        testData.status.id,
        createDto,
      );

      // Assert
      expect(result.id).toBeDefined();

      // Verify data persisted to database
      const dbRecord = await knexInstance('repair_orders')
        .where('id', result.id)
        .first();
      expect(dbRecord).toBeDefined();
    });
  });

  describe('Sort Value Generation', () => {
    it('should generate sequential sort values for new repair orders', async () => {
      // Arrange
      const adminPayload: AdminPayload = {
        id: testData.admin.id,
        phone: testData.admin.phone,
        full_name: testData.admin.full_name,
        roles: [testData.role.id],
      };

      const createDto: CreateRepairOrderDto = {
        user_id: testData.user.id,
        phone_category_id: testData.phoneCategory.id,
        status_id: testData.status.id,
      };

      // Act - Create multiple repair orders
      const first = await service.create(
        adminPayload,
        testData.branch.id,
        testData.status.id,
        createDto,
      );

      const second = await service.create(
        adminPayload,
        testData.branch.id,
        testData.status.id,
        createDto,
      );

      const third = await service.create(
        adminPayload,
        testData.branch.id,
        testData.status.id,
        createDto,
      );

      // Assert
      expect(first.sort).toBeLessThan(second.sort);
      expect(second.sort).toBeLessThan(third.sort);
    });
  });

  describe('Permission Integration', () => {
    it('should check permissions before allowing create operation', async () => {
      // Arrange
      const adminPayload: AdminPayload = {
        id: testData.admin.id,
        phone: testData.admin.phone,
        full_name: testData.admin.full_name,
        roles: [testData.role.id],
      };

      const createDto: CreateRepairOrderDto = {
        user_id: testData.user.id,
        phone_category_id: testData.phoneCategory.id,
        status_id: testData.status.id,
      };

      // Act
      await service.create(
        adminPayload,
        testData.branch.id,
        testData.status.id,
        createDto,
      );

      // Assert
      expect(mockPermissionService.findByRolesAndBranch).toHaveBeenCalledWith(
        adminPayload.roles,
        testData.branch.id,
      );
      expect(mockPermissionService.checkPermissionsOrThrow).toHaveBeenCalledWith(
        adminPayload.roles,
        testData.branch.id,
        testData.status.id,
        ['can_add'],
        'repair_order_permission',
        testData.permissions,
      );
    });
  });

  describe('Data Validation', () => {
    it('should validate user exists and is active', async () => {
      // Arrange - Create inactive user
      const [inactiveUser] = await knexInstance('users')
        .insert({
          id: MockFactory.createAdmin().id,
          phone: '+998901234569',
          status: 'Closed', // Inactive status
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('*');

      const adminPayload: AdminPayload = {
        id: testData.admin.id,
        phone: testData.admin.phone,
        full_name: testData.admin.full_name,
        roles: [testData.role.id],
      };

      const createDto: CreateRepairOrderDto = {
        user_id: inactiveUser.id,
        phone_category_id: testData.phoneCategory.id,
        status_id: testData.status.id,
      };

      // Act & Assert
      await expect(
        service.create(
          adminPayload,
          testData.branch.id,
          testData.status.id,
          createDto,
        ),
      ).rejects.toThrow('User not found or inactive');
    });

    it('should validate phone category exists and is active', async () => {
      // Arrange - Create inactive phone category
      const [inactiveCategory] = await knexInstance('phone_categories')
        .insert({
          id: MockFactory.createAdmin().id,
          name: 'Inactive Category',
          is_active: false, // Inactive
          status: 'Open',
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('*');

      const adminPayload: AdminPayload = {
        id: testData.admin.id,
        phone: testData.admin.phone,
        full_name: testData.admin.full_name,
        roles: [testData.role.id],
      };

      const createDto: CreateRepairOrderDto = {
        user_id: testData.user.id,
        phone_category_id: inactiveCategory.id,
        status_id: testData.status.id,
      };

      // Act & Assert
      await expect(
        service.create(
          adminPayload,
          testData.branch.id,
          testData.status.id,
          createDto,
        ),
      ).rejects.toThrow('Phone category not found or inactive');
    });
  });
});