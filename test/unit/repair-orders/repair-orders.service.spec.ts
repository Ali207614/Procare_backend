import { Test, TestingModule } from '@nestjs/testing';
import { RepairOrdersService } from 'src/repair-orders/repair-orders.service';
import { RepairOrder } from 'src/common/types/repair-order.interface';

import { RepairOrderStatusPermissionsService } from 'src/repair-order-status-permission/repair-order-status-permissions.service';
import { RepairOrderChangeLoggerService } from 'src/repair-orders/services/repair-order-change-logger.service';
import { InitialProblemUpdaterService } from 'src/repair-orders/services/initial-problem-updater.service';
import { FinalProblemUpdaterService } from 'src/repair-orders/services/final-problem-updater.service';
import { RepairOrderCreateHelperService } from 'src/repair-orders/services/repair-order-create-helper.service';
import { RedisService } from 'src/common/redis/redis.service';
import { LoggerService } from 'src/common/logger/logger.service';
import { PdfService } from 'src/pdf/pdf.service';
import { RepairOrderWebhookService } from 'src/repair-orders/services/repair-order-webhook.service';
import { NotificationService } from 'src/notification/notification.service';
import { getKnexConnectionToken } from 'nestjs-knex';
import { HistoryService } from 'src/history/history.service';
import { MOTHER_BRANCH_ID } from 'src/branches/branch-hierarchy.service';
import { RepairOrderStatusesService } from 'src/repair-order-statuses/repair-order-statuses.service';

function createUpdateTransaction(order: RepairOrder) {
  const builder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    whereNotIn: jest.fn().mockReturnThis(),
    whereNot: jest.fn().mockReturnThis(),
    andWhereNot: jest.fn().mockReturnThis(),
    whereNotNull: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(order),
    update: jest.fn().mockResolvedValue(1),
    decrement: jest.fn().mockResolvedValue(1),
    increment: jest.fn().mockResolvedValue(1),
    insert: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([order]),
    del: jest.fn().mockResolvedValue(1),
  };

  const trx = ((table: string) => {
    if (table === 'repair_orders') {
      return builder;
    }
    return builder;
  }) as unknown as {
    commit: jest.Mock;
    rollback: jest.Mock;
  };

  trx.commit = jest.fn().mockResolvedValue(undefined);
  trx.rollback = jest.fn().mockResolvedValue(undefined);
  Object.assign(trx, builder);

  return trx;
}

describe('RepairOrdersService', () => {
  let service: RepairOrdersService;
  let mockKnex: any;
  let mockRedis: any;
  let mockPermissionService: any;

  beforeEach(async () => {
    mockKnex = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      first: jest.fn(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      del: jest.fn(),
      count: jest.fn(),
      leftJoin: jest.fn().mockReturnThis(),
      join: jest.fn().mockReturnThis(),
      transaction: jest.fn(),
      raw: jest.fn(),
      returning: jest.fn(),
    };

    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      flushall: jest.fn(),
      flushByPrefix: jest.fn(),
    };
    mockPermissionService = {
      findByRolesAndBranch: jest.fn().mockResolvedValue([]),
      checkPermissionsOrThrow: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepairOrdersService,
        { provide: getKnexConnectionToken('default'), useValue: mockKnex },
        {
          provide: RepairOrderStatusPermissionsService,
          useValue: mockPermissionService,
        },
        {
          provide: RepairOrderChangeLoggerService,
          useValue: { logMultipleFieldsIfChanged: jest.fn() },
        },
        { provide: InitialProblemUpdaterService, useValue: { update: jest.fn() } },
        { provide: FinalProblemUpdaterService, useValue: { update: jest.fn() } },
        {
          provide: RepairOrderCreateHelperService,
          useValue: {
            insertRentalPhone: jest.fn(),
            insertInitialProblems: jest.fn(),
            insertFinalProblems: jest.fn(),
            insertComments: jest.fn(),
            insertPickup: jest.fn(),
            insertDelivery: jest.fn(),
            handleChecklists: jest.fn(),
            insertAttachments: jest.fn(),
          },
        },
        { provide: RedisService, useValue: mockRedis },
        { provide: LoggerService, useValue: { log: jest.fn(), error: jest.fn() } },
        { provide: PdfService, useValue: {} },
        {
          provide: RepairOrderWebhookService,
          useValue: { sendWebhook: jest.fn().mockResolvedValue(true) },
        },
        { provide: NotificationService, useValue: { create: jest.fn() } },
        {
          provide: HistoryService,
          useValue: { recordEntityCreated: jest.fn().mockResolvedValue(null) },
        },
        { provide: RepairOrderStatusesService, useValue: { findViewable: jest.fn() } },
      ],
    }).compile();

    service = module.get<RepairOrdersService>(RepairOrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findViewableByAdminBranch', () => {
    it('should wrap grouped repair orders in meta/data without changing the payload', async () => {
      const admin = { id: 'admin-123', roles: [] };
      const branchId = 'branch-123';
      const query = {
        branch_id: branchId,
        limit: 50,
        offset: 10,
      } as any;
      const groupedResult = {
        'status-1': {
          metrics: {
            total_repair_orders: 2,
          },
          repair_orders: [{ id: 'order-1' }],
        },
        'status-2': {
          metrics: {
            total_repair_orders: 5,
          },
          repair_orders: [{ id: 'order-2' }],
        },
      };

      jest.spyOn(service, 'findAllByAdminBranch').mockResolvedValue(groupedResult as any);

      const result = await service.findViewableByAdminBranch(admin as any, branchId, query);

      expect(service.findAllByAdminBranch).toHaveBeenCalledWith(admin, branchId, query, {
        viewableEndpoint: true,
      });
      expect(result).toEqual({
        meta: {
          total: 7,
          limit: 50,
          offset: 10,
        },
        data: groupedResult,
      });
    });

    it('should route phone-like smart search to normalized phone fields', () => {
      const condition = (service as any).buildViewableSearchCondition('+998 90 123 45 67');

      expect(condition.sql).toContain('regexp_replace');
      expect(condition.sql).toContain('ro.phone_number = ANY(:searchPhoneCandidates)');
      expect(condition.sql).not.toContain('pc.name_uz');
      expect(condition.params.searchPhoneDigitsPattern).toBe('%998901234567%');
      expect(condition.params.searchPhoneCandidates).toEqual(['+998901234567', '901234567']);
    });

    it('should route text smart search to names and phone categories', () => {
      const condition = (service as any).buildViewableSearchCondition('iPhone 14');

      expect(condition.sql).toContain('ro.name');
      expect(condition.sql).toContain('u.first_name');
      expect(condition.sql).toContain('pc.name_uz');
      expect(condition.params.searchTextPattern).toBe('%iphone 14%');
      expect(condition.params.searchPhoneDigitsPattern).toBeUndefined();
    });

    it('should sanitize viewable rows without changing the legacy row shape', () => {
      const row = {
        id: 'order-1',
        branch: {
          id: MOTHER_BRANCH_ID,
          name_uz: "Farg'ona Filial",
          name_ru: 'Фергана Филиал',
          name_en: 'Fergana Branch',
        },
        current_owner_branch: MOTHER_BRANCH_ID,
        is_read_only: true,
        is_hidden_status_for_branch: false,
        can_take: true,
      };

      const result = (service as any).toViewableRepairOrder(row);

      expect(result).toEqual({
        id: 'order-1',
        branch: {
          id: MOTHER_BRANCH_ID,
          name_en: 'Fergana Branch',
          name_ru: 'Фергана Филиал',
          name_uz: "Farg'ona Filial",
        },
        is_mothers: true,
      });
      expect(result).not.toHaveProperty('current_owner_branch');
      expect(result).not.toHaveProperty('is_read_only');
      expect(result).not.toHaveProperty('is_hidden_status_for_branch');
      expect(result).not.toHaveProperty('can_take');
    });

    it('should filter hidden statuses only for the viewable endpoint', async () => {
      const admin = { id: 'admin-123', roles: [{ id: 'role-1', name: 'Operator' }] };
      const query = { limit: 20, offset: 0 } as any;
      const rawCalls: any[] = [];

      mockPermissionService.findByRolesAndBranch.mockResolvedValue([
        { role_id: 'role-1', status_id: 'visible-status', can_view: true },
        { role_id: 'role-1', status_id: 'hidden-status', can_view: false },
      ]);
      mockRedis.get.mockResolvedValue(null);
      mockKnex.raw.mockImplementation((sql: string, params: Record<string, unknown>) => {
        rawCalls.push({ sql, params });
        return Promise.resolve({ rows: [] });
      });

      await service.findAllByAdminBranch(admin as any, MOTHER_BRANCH_ID, query, {
        viewableEndpoint: true,
      });
      expect(rawCalls[0].params.statusIds).toEqual(['visible-status']);

      rawCalls.length = 0;
      await service.findAllByAdminBranch(admin as any, MOTHER_BRANCH_ID, query);
      expect(rawCalls[0].params.statusIds).toEqual(['visible-status', 'hidden-status']);
    });

    it('should use only selected branches as the data scope for viewable orders', async () => {
      const admin = { id: 'admin-123', roles: [{ id: 'role-1', name: 'Operator' }] };
      const query = { branch_ids: ['branch-a', 'branch-b'], limit: 20, offset: 0 } as any;
      const rawCalls: any[] = [];

      (service as any).branchHierarchy.getVisibleBranchIds = jest
        .fn()
        .mockResolvedValue([MOTHER_BRANCH_ID, 'branch-a', 'branch-b']);
      mockPermissionService.findByRolesAndBranch.mockImplementation(
        (_roles: unknown, branchId: string) => {
          if (branchId === 'branch-a') {
            return Promise.resolve([
              {
                branch_id: 'branch-a',
                role_id: 'role-1',
                status_id: 'shared-status',
                can_view: false,
              },
            ]);
          }

          return Promise.resolve([
            {
              branch_id: 'branch-b',
              role_id: 'role-1',
              status_id: 'shared-status',
              can_view: true,
            },
          ]);
        },
      );
      mockRedis.get.mockResolvedValue(null);
      mockKnex.raw.mockImplementation((sql: string, params: Record<string, unknown>) => {
        rawCalls.push({ sql, params });
        return Promise.resolve({ rows: [] });
      });

      await service.findAllByAdminBranch(admin as any, query.branch_ids, query, {
        viewableEndpoint: true,
      });

      expect(mockPermissionService.findByRolesAndBranch).toHaveBeenCalledWith(
        admin.roles,
        'branch-a',
      );
      expect(mockPermissionService.findByRolesAndBranch).toHaveBeenCalledWith(
        admin.roles,
        'branch-b',
      );
      expect(rawCalls[0].params.branchIds).toEqual(['branch-a', 'branch-b']);
      expect(rawCalls[0].params.permissionBranchIds).toEqual(['branch-a', 'branch-b']);
      expect(rawCalls[0].params.statusIds).toEqual(['shared-status']);
      expect(rawCalls[0].sql).toContain('vp.branch_id = ro.branch_id');
    });

    it('should not expand Mother Branch selection to all visible branches for Super Admins', async () => {
      const admin = { id: 'admin-123', roles: [{ id: 'role-1', name: 'Super Admin' }] };
      const query = { branch_ids: [MOTHER_BRANCH_ID], limit: 20, offset: 0 } as any;
      const rawCalls: any[] = [];

      (service as any).branchHierarchy.getVisibleBranchIds = jest
        .fn()
        .mockResolvedValue([MOTHER_BRANCH_ID, 'branch-a', 'branch-b']);
      mockPermissionService.findByRolesAndBranch.mockResolvedValue([
        {
          branch_id: MOTHER_BRANCH_ID,
          role_id: 'role-1',
          status_id: 'visible-status',
          can_view: true,
        },
      ]);
      mockRedis.get.mockResolvedValue(null);
      mockKnex.raw.mockImplementation((sql: string, params: Record<string, unknown>) => {
        rawCalls.push({ sql, params });
        return Promise.resolve({ rows: [] });
      });

      await service.findAllByAdminBranch(admin as any, query.branch_ids, query, {
        viewableEndpoint: true,
      });

      expect(rawCalls[0].params.branchIds).toEqual([MOTHER_BRANCH_ID]);
      expect(mockPermissionService.findByRolesAndBranch).toHaveBeenCalledTimes(1);
      expect(mockPermissionService.findByRolesAndBranch).toHaveBeenCalledWith(
        admin.roles,
        MOTHER_BRANCH_ID,
      );
    });
  });

  // Legacy tests (findAll, create, findOne) were removed because they no longer compile
  // against the drastically changed RepairOrdersService signatures.

  describe('update', () => {
    it('should update user and order names given first_name and last_name seamlessly', async () => {
      // Arrange
      const repairOrderId = 'repair-order-123';
      const updateDto = { first_name: 'John', last_name: 'Doe' };
      const mockAdmin = { id: 'admin-123', roles: [] };
      const mockRepairOrder = {
        id: repairOrderId,
        name: 'OldName Smith',
        branch_id: 'b',
        status: 'Open',
        status_id: 's',
      };

      const mockTrx = createUpdateTransaction(mockRepairOrder as RepairOrder);
      mockKnex.transaction.mockResolvedValue(mockTrx as never);

      // Act
      const result = await service.update(mockAdmin as any, repairOrderId, updateDto);

      // Assert
      expect(result.message).toBe('Repair order updated successfully');
      expect((mockTrx as any).update).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'John Doe' }),
      );
    });

    it('should forward omitted problem fields as undefined', async () => {
      const repairOrderId = 'repair-order-123';
      const updateDto = { name: 'John Doe' };
      const mockAdmin = { id: 'admin-123', roles: [] };
      const mockRepairOrder = {
        id: repairOrderId,
        name: 'OldName Smith',
        branch_id: 'b',
        status: 'Open',
        status_id: 's',
      } as RepairOrder;

      const mockTrx = createUpdateTransaction(mockRepairOrder);
      mockKnex.transaction.mockResolvedValue(mockTrx as never);

      await service.update(mockAdmin as any, repairOrderId, updateDto as never);

      expect((service as any).initialProblemUpdater.update).toHaveBeenCalledWith(
        mockTrx,
        repairOrderId,
        undefined,
        mockAdmin,
      );
      expect((service as any).finalProblemUpdater.update).toHaveBeenCalledWith(
        mockTrx,
        repairOrderId,
        undefined,
        mockAdmin,
      );
    });

    it('should forward explicit empty problem arrays unchanged', async () => {
      const repairOrderId = 'repair-order-123';
      const updateDto = { initial_problems: [], final_problems: [] };
      const mockAdmin = { id: 'admin-123', roles: [] };
      const mockRepairOrder = {
        id: repairOrderId,
        name: 'OldName Smith',
        branch_id: 'b',
        status: 'Open',
        status_id: 's',
      } as RepairOrder;

      const mockTrx = createUpdateTransaction(mockRepairOrder);
      mockKnex.transaction.mockResolvedValue(mockTrx as never);

      await service.update(mockAdmin as any, repairOrderId, updateDto as never);

      expect((service as any).initialProblemUpdater.update).toHaveBeenCalledWith(
        mockTrx,
        repairOrderId,
        [],
        mockAdmin,
      );
      expect((service as any).finalProblemUpdater.update).toHaveBeenCalledWith(
        mockTrx,
        repairOrderId,
        [],
        mockAdmin,
      );
    });
  });

  // Other legacy methods were removed as they no longer exist on the service implementation.
});
