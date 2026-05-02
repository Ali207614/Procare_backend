import { Test, TestingModule } from '@nestjs/testing';
import { RepairOrderStatusesService } from '../../src/repair-order-statuses/repair-order-statuses.service';
import { RedisService } from '../../src/common/redis/redis.service';
import { RepairOrderStatusPermissionsService } from '../../src/repair-order-status-permission/repair-order-status-permissions.service';
import { LoggerService } from '../../src/common/logger/logger.service';
import { HistoryService } from '../../src/history/history.service';

describe('RepairOrderStatusesService', () => {
  let service: RepairOrderStatusesService;
  let mockKnex: any;
  let mockRedisService: any;
  let mockPermissionsService: any;
  let mockLogger: any;
  let mockHistoryService: any;

  beforeEach(async () => {
    mockKnex = jest.fn(() => mockKnex);
    mockKnex.where = jest.fn().mockReturnThis();
    mockKnex.whereIn = jest.fn().mockReturnThis();
    mockKnex.andWhere = jest.fn().mockReturnThis();
    mockKnex.andWhereNot = jest.fn().mockReturnThis();
    mockKnex.orderBy = jest.fn().mockReturnThis();
    mockKnex.offset = jest.fn().mockReturnThis();
    mockKnex.limit = jest.fn().mockReturnThis();
    mockKnex.count = jest.fn().mockReturnThis();
    mockKnex.groupBy = jest.fn().mockReturnThis();
    mockKnex.select = jest.fn().mockReturnThis();
    mockKnex.clone = jest.fn().mockReturnThis();
    mockKnex.first = jest.fn();
    mockKnex.transaction = jest.fn().mockImplementation(async () => mockKnex);
    mockKnex.commit = jest.fn();
    mockKnex.rollback = jest.fn();
    mockKnex.raw = jest.fn((value) => value);

    mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      flushByPrefix: jest.fn(),
    };

    mockPermissionsService = {
      findByRolesAndBranch: jest.fn(),
    };

    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockHistoryService = {
      recordEntityUpdated: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepairOrderStatusesService,
        { provide: 'default_KnexModuleConnectionToken', useValue: mockKnex },
        { provide: RedisService, useValue: mockRedisService },
        { provide: RepairOrderStatusPermissionsService, useValue: mockPermissionsService },
        { provide: LoggerService, useValue: mockLogger },
        { provide: HistoryService, useValue: mockHistoryService },
      ],
    }).compile();

    service = module.get<RepairOrderStatusesService>(RepairOrderStatusesService);
  });

  describe('findViewable', () => {
    it('should return viewable statuses with correct metrics', async () => {
      // Arrange
      const admin = { id: 'admin-1', roles: [{ id: 'role-1', name: 'Admin' }] };
      const branchId = 'branch-1';
      
      const mockStatuses = [
        { id: 'status-1', name_uz: 'S1', branch_id: branchId },
        { id: 'status-2', name_uz: 'S2', branch_id: branchId },
      ];
      
      const mockPermissions = [
        { status_id: 'status-1', can_view: true },
        { status_id: 'status-2', can_view: true },
      ];

      const mockCounts = [
        { status_id: 'status-1', count: '10' },
        { status_id: 'status-2', count: '5' },
      ];

      mockRedisService.get.mockResolvedValue(null);
      mockPermissionsService.findByRolesAndBranch.mockResolvedValue(mockPermissions);
      jest
        .spyOn(service as any, 'findTransitionsForRoleScope')
        .mockResolvedValue({ source: 'fallback', rows: [] });

      // We need to carefully mock the 4 concurrent queries in Promise.all
      // 1. statuses list
      // 2. total count
      // 3. transitions
      // 4. repair order counts
      
      // A more robust way in unit tests without a real knex is to mock the return of the chain.
      // Since they all use the same mockKnex instance, we can use mockResolvedValueOnce for each top-level 'thenable'
      
      const mockChain = {
        clone: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        count: jest.fn().mockReturnThis(),
        whereIn: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        andWhereNot: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        then: jest.fn()
          .mockImplementationOnce((resolve) => resolve(mockStatuses)) // statuses
          .mockImplementationOnce((resolve) => resolve([{ count: '2' }])) // total count
          .mockImplementationOnce((resolve) => resolve(mockCounts)), // counts
      };

      mockKnex.clone = jest.fn().mockReturnValue(mockChain);
      mockKnex.mockReturnValue(mockChain); // for trx() calls

      // Act
      const result = await service.findViewable(admin as any, branchId);

      // Assert
      expect(result.rows[0].metrics!.total_repair_orders).toBe(10);
      expect(result.rows[1].metrics!.total_repair_orders).toBe(5);
      expect(result.total).toBe(2);
    });
  });

  describe('updateSort', () => {
    it('uses the current database sort instead of a stale guard status', async () => {
      const branchId = 'branch-1';
      const staleStatus = {
        id: 'status-1',
        name_uz: 'Status 1',
        sort: 2,
        branch_id: branchId,
      };
      const currentStatus = {
        ...staleStatus,
        sort: 1,
        status: 'Open',
      };

      const makeQuery = (result: any) => {
        const query: any = {
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn((arg?: any) => {
            if (typeof arg === 'function') {
              arg(query);
            }
            return query;
          }),
          first: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          update: jest.fn().mockResolvedValue(1),
          then: jest.fn((resolve, reject) => Promise.resolve(result).then(resolve, reject)),
        };
        return query;
      };

      const queries = [
        makeQuery(currentStatus),
        makeQuery([{ id: 'status-1' }, { id: 'status-2' }]),
        makeQuery(1),
        makeQuery(1),
      ];
      const trx: any = jest.fn(() => queries.shift());
      trx.commit = jest.fn().mockResolvedValue(undefined);
      trx.rollback = jest.fn().mockResolvedValue(undefined);
      mockKnex.transaction.mockResolvedValue(trx);

      const result = await service.updateSort(staleStatus as any, 2, 'admin-1');

      expect(result).toEqual({ message: 'Sort updated successfully' });
      expect(mockHistoryService.recordEntityUpdated).toHaveBeenCalledWith(
        expect.objectContaining({
          before: expect.objectContaining({ sort: 1 }),
          after: expect.objectContaining({ sort: 2 }),
        }),
      );
      expect(mockRedisService.del).toHaveBeenCalledWith('repair_order_statuses:id:status-1');
      expect(mockRedisService.del).toHaveBeenCalledWith('repair_order_statuses:id:status-2');
      expect(trx.commit).toHaveBeenCalled();
      expect(trx.rollback).not.toHaveBeenCalled();
    });
  });
});
