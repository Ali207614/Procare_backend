import { Test, TestingModule } from '@nestjs/testing';
import { RepairOrdersService } from '../../src/repair-orders.service';
import { Knex } from 'knex';
import { getKnexToken } from 'nestjs-knex';
import { RedisService } from '../../src/common/redis/redis.service';
import { RepairOrderStatusPermissionsService } from '../../src/repair-order-status-permission/repair-order-status-permissions.service';
import { RepairOrderChangeLoggerService } from '../../src/services/repair-order-change-logger.service';
import { InitialProblemUpdaterService } from '../../src/services/initial-problem-updater.service';
import { FinalProblemUpdaterService } from '../../src/services/final-problem-updater.service';
import { RepairOrderCreateHelperService } from '../../src/services/repair-order-create-helper.service';
import { LoggerService } from '../../src/common/logger/logger.service';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreateRepairOrderDto } from '../../src/dto/create-repair-order.dto';
import { AdminPayload } from '../../src/common/types/admin-payload.interface';
import { RepairOrder } from '../../src/common/types/repair-order.interface';

describe('RepairOrdersService', () => {
  let service: RepairOrdersService;
  let knexMock: jest.Mocked<Knex>;
  let redisMock: jest.Mocked<RedisService>;
  let permissionServiceMock: jest.Mocked<RepairOrderStatusPermissionsService>;
  let changeLoggerMock: jest.Mocked<RepairOrderChangeLoggerService>;
  let initialProblemUpdaterMock: jest.Mocked<InitialProblemUpdaterService>;
  let finalProblemUpdaterMock: jest.Mocked<FinalProblemUpdaterService>;
  let helperMock: jest.Mocked<RepairOrderCreateHelperService>;
  let loggerMock: jest.Mocked<LoggerService>;

  const mockAdminPayload: AdminPayload = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    phone: '+998901234567',
    full_name: 'Test Admin',
    roles: ['admin-role-id'],
  };

  const mockRepairOrder: RepairOrder = {
    id: '660e8400-e29b-41d4-a716-446655440001',
    user_id: '770e8400-e29b-41d4-a716-446655440002',
    branch_id: '880e8400-e29b-41d4-a716-446655440003',
    phone_category_id: '990e8400-e29b-41d4-a716-446655440004',
    status_id: 'aa0e8400-e29b-41d4-a716-446655440005',
    priority: 'Medium',
    sort: 1,
    delivery_method: 'Self',
    pickup_method: 'Self',
    created_by: mockAdminPayload.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as RepairOrder;

  const mockUser = {
    id: '770e8400-e29b-41d4-a716-446655440002',
    phone: '+998901234568',
    status: 'Open',
  };

  const mockPhoneCategory = {
    id: '990e8400-e29b-41d4-a716-446655440004',
    name: 'iPhone',
    is_active: true,
    status: 'Open',
    has_children: false,
  };

  const mockPermissions = [
    {
      role_id: 'admin-role-id',
      branch_id: '880e8400-e29b-41d4-a716-446655440003',
      status_id: 'aa0e8400-e29b-41d4-a716-446655440005',
      can_add: true,
      can_edit: true,
    },
  ];

  beforeEach(async () => {
    const mockQueryBuilder: any = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      whereNotNull: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      first: jest.fn(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      del: jest.fn(),
      returning: jest.fn(),
      join: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      count: jest.fn(),
      raw: jest.fn(),
      clone: jest.fn().mockReturnThis(),
    };

    const mockTransaction: any = {
      ...mockQueryBuilder,
      commit: jest.fn(),
      rollback: jest.fn(),
    };

    knexMock = {
      transaction: jest.fn().mockResolvedValue(mockTransaction),
      raw: jest.fn(),
      ...mockQueryBuilder,
    } as any;

    // Setup transaction to return itself when called with a function
    knexMock.transaction.mockImplementation((callback?: any) => {
      if (typeof callback === 'function') {
        return callback(mockTransaction);
      }
      return Promise.resolve(mockTransaction);
    });

    redisMock = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      flushByPrefix: jest.fn(),
    } as any;

    permissionServiceMock = {
      findByRolesAndBranch: jest.fn(),
      checkPermissionsOrThrow: jest.fn(),
    } as any;

    changeLoggerMock = {
      logChange: jest.fn(),
    } as any;

    initialProblemUpdaterMock = {
      update: jest.fn(),
    } as any;

    finalProblemUpdaterMock = {
      update: jest.fn(),
    } as any;

    helperMock = {
      insertAssignAdmins: jest.fn(),
      insertRentalPhone: jest.fn(),
      insertInitialProblems: jest.fn(),
      insertFinalProblems: jest.fn(),
      insertComments: jest.fn(),
      insertPickup: jest.fn(),
      insertDelivery: jest.fn(),
    } as any;

    loggerMock = {
      error: jest.fn(),
      log: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepairOrdersService,
        {
          provide: getKnexToken(),
          useValue: knexMock,
        },
        {
          provide: RedisService,
          useValue: redisMock,
        },
        {
          provide: RepairOrderStatusPermissionsService,
          useValue: permissionServiceMock,
        },
        {
          provide: RepairOrderChangeLoggerService,
          useValue: changeLoggerMock,
        },
        {
          provide: InitialProblemUpdaterService,
          useValue: initialProblemUpdaterMock,
        },
        {
          provide: FinalProblemUpdaterService,
          useValue: finalProblemUpdaterMock,
        },
        {
          provide: RepairOrderCreateHelperService,
          useValue: helperMock,
        },
        {
          provide: LoggerService,
          useValue: loggerMock,
        },
      ],
    }).compile();

    service = module.get<RepairOrdersService>(RepairOrdersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateRepairOrderDto = {
      user_id: '770e8400-e29b-41d4-a716-446655440002',
      phone_category_id: '990e8400-e29b-41d4-a716-446655440004',
      status_id: 'aa0e8400-e29b-41d4-a716-446655440005',
      priority: 'High',
    };

    beforeEach(() => {
      permissionServiceMock.findByRolesAndBranch.mockResolvedValue(mockPermissions);
      permissionServiceMock.checkPermissionsOrThrow.mockResolvedValue(undefined);
    });

    it('should create a repair order successfully', async () => {
      // Arrange
      const trxMock = knexMock.transaction() as any;
      trxMock.insert.mockReturnValue({ returning: jest.fn().mockResolvedValue([mockRepairOrder]) });
      trxMock.first.mockResolvedValueOnce(mockUser); // For user lookup
      trxMock.select.mockReturnValueOnce(trxMock);
      trxMock.where.mockReturnValueOnce(trxMock);
      trxMock.first.mockResolvedValueOnce(mockPhoneCategory); // For phone category lookup

      jest.doMock('../common/utils/sort.util', () => ({
        getNextSortValue: jest.fn().mockResolvedValue(1),
      }));

      // Act
      const result = await service.create(
        mockAdminPayload,
        '880e8400-e29b-41d4-a716-446655440003',
        'aa0e8400-e29b-41d4-a716-446655440005',
        createDto,
      );

      // Assert
      expect(result).toEqual(mockRepairOrder);
      expect(permissionServiceMock.checkPermissionsOrThrow).toHaveBeenCalledWith(
        mockAdminPayload.roles,
        '880e8400-e29b-41d4-a716-446655440003',
        'aa0e8400-e29b-41d4-a716-446655440005',
        ['can_add'],
        'repair_order_permission',
        mockPermissions,
      );
      expect(redisMock.flushByPrefix).toHaveBeenCalledWith(
        'repair_orders:880e8400-e29b-41d4-a716-446655440003',
      );
    });

    it('should throw BadRequestException when user not found', async () => {
      // Arrange
      const trxMock = knexMock.transaction() as any;
      trxMock.where.mockReturnValueOnce(trxMock);
      trxMock.first.mockResolvedValueOnce(null); // User not found

      // Act & Assert
      await expect(
        service.create(
          mockAdminPayload,
          '880e8400-e29b-41d4-a716-446655440003',
          'aa0e8400-e29b-41d4-a716-446655440005',
          createDto,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(trxMock.rollback).toHaveBeenCalled();
    });

    it('should throw BadRequestException when phone category not found', async () => {
      // Arrange
      const trxMock = knexMock.transaction() as any;
      trxMock.where.mockReturnValueOnce(trxMock);
      trxMock.first.mockResolvedValueOnce(mockUser); // User found
      trxMock.select.mockReturnValueOnce(trxMock);
      trxMock.where.mockReturnValueOnce(trxMock);
      trxMock.first.mockResolvedValueOnce(null); // Phone category not found

      // Act & Assert
      await expect(
        service.create(
          mockAdminPayload,
          '880e8400-e29b-41d4-a716-446655440003',
          'aa0e8400-e29b-41d4-a716-446655440005',
          createDto,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(trxMock.rollback).toHaveBeenCalled();
    });

    it('should throw BadRequestException when phone category has children', async () => {
      // Arrange
      const phoneCategoryWithChildren = { ...mockPhoneCategory, has_children: true };
      const trxMock = knexMock.transaction() as any;
      trxMock.where.mockReturnValueOnce(trxMock);
      trxMock.first.mockResolvedValueOnce(mockUser);
      trxMock.select.mockReturnValueOnce(trxMock);
      trxMock.where.mockReturnValueOnce(trxMock);
      trxMock.first.mockResolvedValueOnce(phoneCategoryWithChildren);

      // Act & Assert
      await expect(
        service.create(
          mockAdminPayload,
          '880e8400-e29b-41d4-a716-446655440003',
          'aa0e8400-e29b-41d4-a716-446655440005',
          createDto,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(trxMock.rollback).toHaveBeenCalled();
    });

    it('should rollback transaction on helper service error', async () => {
      // Arrange
      const trxMock = knexMock.transaction() as any;
      trxMock.first.mockResolvedValueOnce(mockUser);
      trxMock.select.mockReturnValueOnce(trxMock);
      trxMock.where.mockReturnValueOnce(trxMock);
      trxMock.first.mockResolvedValueOnce(mockPhoneCategory);
      trxMock.insert.mockReturnValue({ returning: jest.fn().mockResolvedValue([mockRepairOrder]) });

      helperMock.insertAssignAdmins.mockRejectedValue(new Error('Helper service error'));

      // Act & Assert
      await expect(
        service.create(
          mockAdminPayload,
          '880e8400-e29b-41d4-a716-446655440003',
          'aa0e8400-e29b-41d4-a716-446655440005',
          createDto,
        ),
      ).rejects.toThrow();

      expect(trxMock.rollback).toHaveBeenCalled();
      expect(loggerMock.error).toHaveBeenCalledWith('Failed to create repair order:');
    });
  });

  describe('findAll', () => {
    it('should return paginated repair orders with correct query parameters', async () => {
      // Arrange
      const mockOrders = [mockRepairOrder];
      const query = {
        branch_id: '880e8400-e29b-41d4-a716-446655440003',
        limit: 10,
        offset: 0,
        status_id: 'aa0e8400-e29b-41d4-a716-446655440005',
        priority: 'High',
        sort_by: 'created_at',
        sort_order: 'desc' as const,
      };

      knexMock.select.mockResolvedValue(mockOrders);
      knexMock.raw.mockResolvedValue({ rows: [{ count: '1' }] });

      // Act
      const result = await service.findAll(query);

      // Assert
      expect(result.data).toEqual(mockOrders);
      expect(result.meta.total).toBe(1);
      expect(knexMock.where).toHaveBeenCalledWith('ro.branch_id', query.branch_id);
      expect(knexMock.limit).toHaveBeenCalledWith(query.limit);
      expect(knexMock.offset).toHaveBeenCalledWith(query.offset);
    });

    it('should apply search filter when provided', async () => {
      // Arrange
      const query = {
        branch_id: '880e8400-e29b-41d4-a716-446655440003',
        search: 'test search',
        limit: 10,
        offset: 0,
      };

      knexMock.select.mockResolvedValue([]);
      knexMock.raw.mockResolvedValue({ rows: [{ count: '0' }] });

      // Act
      await service.findAll(query);

      // Assert
      expect(knexMock.andWhere).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    const orderId = '660e8400-e29b-41d4-a716-446655440001';

    it('should return repair order when found', async () => {
      // Arrange
      knexMock.first.mockResolvedValue(mockRepairOrder);

      // Act
      const result = await service.findById(orderId);

      // Assert
      expect(result).toEqual(mockRepairOrder);
      expect(knexMock.where).toHaveBeenCalledWith('ro.id', orderId);
    });

    it('should throw NotFoundException when repair order not found', async () => {
      // Arrange
      knexMock.first.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findById(orderId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('caching behavior', () => {
    it('should flush cache by prefix after successful operation', async () => {
      // Arrange
      const branchId = '880e8400-e29b-41d4-a716-446655440003';

      // Act
      await service['redisService'].flushByPrefix(`repair_orders:${branchId}`);

      // Assert
      expect(redisMock.flushByPrefix).toHaveBeenCalledWith(`repair_orders:${branchId}`);
    });
  });

  describe('permission checking', () => {
    it('should check permissions before allowing operations', async () => {
      // Arrange
      const createDto: CreateRepairOrderDto = {
        user_id: '770e8400-e29b-41d4-a716-446655440002',
        phone_category_id: '990e8400-e29b-41d4-a716-446655440004',
        status_id: 'aa0e8400-e29b-41d4-a716-446655440005',
      };

      permissionServiceMock.findByRolesAndBranch.mockResolvedValue(mockPermissions);
      permissionServiceMock.checkPermissionsOrThrow.mockRejectedValue(
        new ForbiddenException('Insufficient permissions'),
      );

      // Act & Assert
      await expect(
        service.create(
          mockAdminPayload,
          '880e8400-e29b-41d4-a716-446655440003',
          'aa0e8400-e29b-41d4-a716-446655440005',
          createDto,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(permissionServiceMock.checkPermissionsOrThrow).toHaveBeenCalledWith(
        mockAdminPayload.roles,
        '880e8400-e29b-41d4-a716-446655440003',
        'aa0e8400-e29b-41d4-a716-446655440005',
        ['can_add'],
        'repair_order_permission',
        mockPermissions,
      );
    });
  });

  describe('error handling', () => {
    it('should handle and log database errors', async () => {
      // Arrange
      const createDto: CreateRepairOrderDto = {
        user_id: '770e8400-e29b-41d4-a716-446655440002',
        phone_category_id: '990e8400-e29b-41d4-a716-446655440004',
        status_id: 'aa0e8400-e29b-41d4-a716-446655440005',
      };

      knexMock.transaction.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(
        service.create(
          mockAdminPayload,
          '880e8400-e29b-41d4-a716-446655440003',
          'aa0e8400-e29b-41d4-a716-446655440005',
          createDto,
        ),
      ).rejects.toThrow('Database connection failed');

      expect(loggerMock.error).toHaveBeenCalledWith('Failed to create repair order:');
    });

    it('should preserve HttpExceptions without modification', async () => {
      // Arrange
      const createDto: CreateRepairOrderDto = {
        user_id: '770e8400-e29b-41d4-a716-446655440002',
        phone_category_id: '990e8400-e29b-41d4-a716-446655440004',
        status_id: 'aa0e8400-e29b-41d4-a716-446655440005',
      };

      const httpError = new BadRequestException('Validation failed');
      knexMock.transaction.mockRejectedValue(httpError);

      // Act & Assert
      await expect(
        service.create(
          mockAdminPayload,
          '880e8400-e29b-41d4-a716-446655440003',
          'aa0e8400-e29b-41d4-a716-446655440005',
          createDto,
        ),
      ).rejects.toBe(httpError);
    });
  });
});