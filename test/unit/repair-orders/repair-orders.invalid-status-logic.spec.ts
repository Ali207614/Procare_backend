import { Test, TestingModule } from '@nestjs/testing';
import { RepairOrdersService } from 'src/repair-orders/repair-orders.service';
import { getKnexConnectionToken } from 'nestjs-knex';
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
import { HistoryService } from 'src/history/history.service';
import { RepairOrderStatusesService } from 'src/repair-order-statuses/repair-order-statuses.service';
import { RoleType } from 'src/common/types/role-type.enum';
import { BadRequestException } from '@nestjs/common';

describe('RepairOrdersService (Invalid Status Logic)', () => {
  let service: RepairOrdersService;
  let mockKnex: any;
  let builder: any;

  beforeEach(async () => {
    builder = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      andWhereNot: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      join: jest.fn().mockReturnThis(),
      first: jest.fn(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      del: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      pluck: jest.fn(),
      raw: jest.fn().mockImplementation((sql) => sql),
      returning: jest.fn().mockReturnThis(),
    };

    // Support await builder
    builder.then = jest.fn().mockImplementation((resolve) => {
      resolve(builder._result || []);
    });

    mockKnex = jest.fn().mockImplementation(() => builder);
    Object.assign(mockKnex, builder);

    mockKnex.transaction = jest.fn().mockImplementation(async (cb) => {
      if (typeof cb === 'function') {
        return cb(mockKnex);
      }
      return mockKnex;
    });
    mockKnex.commit = jest.fn();
    mockKnex.rollback = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepairOrdersService,
        { provide: getKnexConnectionToken('default'), useValue: mockKnex },
        {
          provide: RepairOrderStatusPermissionsService,
          useValue: {
            findByRolesAndBranch: jest.fn().mockResolvedValue([]),
            checkPermissionsOrThrow: jest.fn(),
          },
        },
        {
          provide: RepairOrderChangeLoggerService,
          useValue: { logMultipleFieldsIfChanged: jest.fn(), logIfChanged: jest.fn() },
        },
        { provide: InitialProblemUpdaterService, useValue: { update: jest.fn() } },
        { provide: FinalProblemUpdaterService, useValue: { update: jest.fn() } },
        {
          provide: RepairOrderCreateHelperService,
          useValue: {
            insertRentalPhone: jest.fn(),
            insertInitialProblems: jest.fn(),
            insertAssignAdmins: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: { flushByPrefix: jest.fn(), del: jest.fn(), set: jest.fn(), get: jest.fn() },
        },
        { provide: LoggerService, useValue: { log: jest.fn(), error: jest.fn() } },
        { provide: PdfService, useValue: {} },
        { provide: RepairOrderWebhookService, useValue: { sendWebhook: jest.fn() } },
        { provide: NotificationService, useValue: { create: jest.fn() } },
        {
          provide: HistoryService,
          useValue: { recordEntityUpdated: jest.fn(), createEvent: jest.fn() },
        },
        { provide: RepairOrderStatusesService, useValue: { getOrLoadStatusById: jest.fn() } },
      ],
    }).compile();

    service = module.get<RepairOrdersService>(RepairOrdersService);
  });

  describe('isInvalidRepairOrderReusable', () => {
    it('should return true if Invalid status entry is within 3 calendar days and entered once', async () => {
      const now = new Date();
      const order = {
        id: 'order-1',
        status_id: 'status-invalid',
        updated_at: now,
        created_at: now,
      };

      builder.first.mockResolvedValue({ type: 'Invalid' });
      builder.pluck.mockResolvedValue(['status-invalid']);
      builder._result = [{ created_at: now.toISOString() }]; // history entry

      const result = await (service as any).isInvalidRepairOrderReusable(order, mockKnex);
      expect(result).toBe(true);
    });

    it('should return false if it entered Invalid status 2 or more times', async () => {
      const now = new Date();
      const order = {
        id: 'order-1',
        status_id: 'status-invalid',
        updated_at: now,
        created_at: now,
      };

      builder.first.mockResolvedValue({ type: 'Invalid' });
      builder.pluck.mockResolvedValue(['status-invalid']);
      builder._result = [
        { created_at: now.toISOString() },
        { created_at: new Date(Date.now() - 86400000).toISOString() },
      ]; // 2 history entries

      const result = await (service as any).isInvalidRepairOrderReusable(order, mockKnex);
      expect(result).toBe(false);
    });

    it('should return false if Invalid status entry is more than 3 calendar days ago', async () => {
      const now = new Date();
      const order = {
        id: 'order-1',
        status_id: 'status-invalid',
        updated_at: now,
        created_at: now,
      };
      const fourDaysAgo = new Date();
      fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

      builder.first.mockResolvedValue({ type: 'Invalid' });
      builder.pluck.mockResolvedValue(['status-invalid']);
      builder._result = [{ created_at: fourDaysAgo.toISOString() }];

      const result = await (service as any).isInvalidRepairOrderReusable(order, mockKnex);
      expect(result).toBe(false);
    });
  });

  describe('handleInvalidStatusReassignment', () => {
    it('should reassign to new operator if all conditions are met', async () => {
      const now = new Date();
      const order = {
        id: 'order-1',
        status_id: 'status-invalid',
        updated_at: now,
        created_at: now,
      };
      const actingAdmin = { id: 'admin-operator-b', roles: [{ type: RoleType.OPERATOR }] };
      const targetStatusId = 'status-open';

      // Mock helpers
      jest.spyOn(service as any, 'isOperatorAdmin').mockReturnValue(true);
      jest
        .spyOn(service as any, 'isInvalidStatus')
        .mockImplementation((status: any) => status.type === 'Invalid');
      jest.spyOn(service as any, 'getStatusDetails').mockImplementation((...args: any[]) => {
        const [trx, id] = args;
        if (id === 'status-invalid') return Promise.resolve({ id, type: 'Invalid' });
        if (id === 'status-open') return Promise.resolve({ id, type: 'Open' });
        return Promise.resolve(null);
      });
      jest.spyOn(service as any, 'isInvalidRepairOrderReusable').mockResolvedValue(true);
      jest.spyOn(service as any, 'getLastDialogueDuration').mockResolvedValue(120);

      builder.pluck.mockResolvedValue(['admin-operator-a']); // current assigned
      builder._result = [{ id: 'admin-operator-a' }]; // assigned operators details

      const assignSpy = jest
        .spyOn(service as any, 'assignAdminToOrderIfNeeded')
        .mockResolvedValue(undefined);

      await (service as any).handleInvalidStatusReassignment(
        mockKnex,
        order,
        targetStatusId,
        actingAdmin,
      );

      expect(builder.delete).toHaveBeenCalled(); // Should delete old operator
      expect(assignSpy).toHaveBeenCalledWith(mockKnex, 'order-1', 'admin-operator-b', 'manual');
    });

    it('should NOT reassign if dialogue_duration is 0', async () => {
      const now = new Date();
      const order = {
        id: 'order-1',
        status_id: 'status-invalid',
        updated_at: now,
        created_at: now,
      };
      const actingAdmin = { id: 'admin-operator-b', roles: [{ type: RoleType.OPERATOR }] };
      const targetStatusId = 'status-open';

      jest.spyOn(service as any, 'isOperatorAdmin').mockReturnValue(true);
      jest
        .spyOn(service as any, 'isInvalidStatus')
        .mockImplementation((status: any) => status.type === 'Invalid');
      jest.spyOn(service as any, 'getStatusDetails').mockImplementation((...args: any[]) => {
        const [trx, id] = args;
        if (id === 'status-invalid') return Promise.resolve({ id, type: 'Invalid' });
        if (id === 'status-open') return Promise.resolve({ id, type: 'Open' });
        return Promise.resolve(null);
      });
      jest.spyOn(service as any, 'isInvalidRepairOrderReusable').mockResolvedValue(true);
      jest.spyOn(service as any, 'getLastDialogueDuration').mockResolvedValue(0); // Zero duration

      const assignSpy = jest.spyOn(service as any, 'assignAdminToOrderIfNeeded');

      await (service as any).handleInvalidStatusReassignment(
        mockKnex,
        order,
        targetStatusId,
        actingAdmin,
      );

      expect(assignSpy).not.toHaveBeenCalled();
    });
  });

  describe('checkForRecentInvalidDuplicatesOrThrow', () => {
    it('should throw BadRequestException if a reusable Invalid RO exists', async () => {
      const existingOrders = [
        { id: 'order-1', status_id: 'status-invalid', phone_category_id: 'cat-1' },
      ];

      builder.pluck.mockResolvedValue(['status-invalid']);
      jest.spyOn(service as any, 'isInvalidRepairOrderReusable').mockResolvedValue(true);

      await expect(
        (service as any).checkForRecentInvalidDuplicatesOrThrow(
          mockKnex,
          existingOrders,
          'cat-1',
          undefined,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should NOT throw if the Invalid RO is NOT reusable', async () => {
      const existingOrders = [
        { id: 'order-1', status_id: 'status-invalid', phone_category_id: 'cat-1' },
      ];

      builder.pluck.mockResolvedValue(['status-invalid']);
      jest.spyOn(service as any, 'isInvalidRepairOrderReusable').mockResolvedValue(false);

      await expect(
        (service as any).checkForRecentInvalidDuplicatesOrThrow(
          mockKnex,
          existingOrders,
          'cat-1',
          undefined,
        ),
      ).resolves.not.toThrow();
    });
  });
});
