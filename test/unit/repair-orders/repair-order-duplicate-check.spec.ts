import { Test, TestingModule } from '@nestjs/testing';
import { RepairOrdersService } from 'src/repair-orders/repair-orders.service';
import { getKnexConnectionToken } from 'nestjs-knex';
import { BadRequestException } from '@nestjs/common';
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

describe('RepairOrdersService (Duplicate Check)', () => {
  let service: RepairOrdersService;
  let mockKnex: any;

  beforeEach(async () => {
    mockKnex = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepairOrdersService,
        { provide: getKnexConnectionToken('default'), useValue: mockKnex },
        { provide: RepairOrderStatusPermissionsService, useValue: {} },
        { provide: RepairOrderChangeLoggerService, useValue: {} },
        { provide: InitialProblemUpdaterService, useValue: {} },
        { provide: FinalProblemUpdaterService, useValue: {} },
        { provide: RepairOrderCreateHelperService, useValue: {} },
        { provide: RedisService, useValue: { flushByPrefix: jest.fn() } },
        { provide: LoggerService, useValue: { error: jest.fn() } },
        { provide: PdfService, useValue: {} },
        { provide: RepairOrderWebhookService, useValue: { sendWebhook: jest.fn() } },
        { provide: NotificationService, useValue: {} },
        { provide: HistoryService, useValue: {} },
        { provide: RepairOrderStatusesService, useValue: {} },
      ],
    }).compile();

    service = module.get<RepairOrdersService>(RepairOrdersService);
  });

  describe('checkForRecentInvalidDuplicatesOrThrow', () => {
    it('should throw BadRequestException if a recent Invalid order exists with same category and IMEI', async () => {
      const mockTrx = jest.fn() as any;
      const invalidStatusId = 'status-invalid-123';
      const orderId = 'order-123';
      const categoryId = 'cat-123';
      const imei = 'imei-123';

      // 1. Pluck invalid status IDs
      mockTrx.mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        pluck: jest.fn().mockResolvedValue([invalidStatusId]),
      });

      // 2. Query for recent invalid order
      const mockRecentQuery = {
        whereIn: jest.fn().mockReturnThis(),
        andWhereRaw: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ id: orderId }),
      };
      mockTrx.mockReturnValueOnce(mockRecentQuery);

      const existingOrders = [
        { id: orderId, status_id: invalidStatusId, phone_category_id: categoryId, imei: imei },
      ] as any;

      await expect(
        (service as any).checkForRecentInvalidDuplicatesOrThrow(
          mockTrx,
          existingOrders,
          categoryId,
          imei,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockRecentQuery.whereIn).toHaveBeenCalledWith('ro.id', [orderId]);
    });

    it('should NOT throw if no Invalid status orders exist', async () => {
      const mockTrx = jest.fn() as any;
      mockTrx.mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        pluck: jest.fn().mockResolvedValue([]),
      });

      await expect(
        (service as any).checkForRecentInvalidDuplicatesOrThrow(mockTrx, [], 'cat-1', 'imei-1'),
      ).resolves.not.toThrow();
    });

    it('should NOT throw if existing orders are for different category', async () => {
      const mockTrx = jest.fn() as any;
      const invalidStatusId = 'status-invalid-123';

      mockTrx.mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        pluck: jest.fn().mockResolvedValue([invalidStatusId]),
      });

      const existingOrders = [
        { id: '1', status_id: invalidStatusId, phone_category_id: 'other-cat', imei: 'imei-1' },
      ] as any;

      await expect(
        (service as any).checkForRecentInvalidDuplicatesOrThrow(
          mockTrx,
          existingOrders,
          'cat-1',
          'imei-1',
        ),
      ).resolves.not.toThrow();
    });

    it('should correctly match orders with no IMEI', async () => {
      const mockTrx = jest.fn() as any;
      const invalidStatusId = 'status-invalid-123';
      const orderId = 'order-no-imei';
      const categoryId = 'cat-123';

      mockTrx.mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        pluck: jest.fn().mockResolvedValue([invalidStatusId]),
      });

      const mockRecentQuery = {
        whereIn: jest.fn().mockReturnThis(),
        andWhereRaw: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ id: orderId }),
      };
      mockTrx.mockReturnValueOnce(mockRecentQuery);

      const existingOrders = [
        { id: orderId, status_id: invalidStatusId, phone_category_id: categoryId, imei: null },
      ] as any;

      await expect(
        (service as any).checkForRecentInvalidDuplicatesOrThrow(
          mockTrx,
          existingOrders,
          categoryId,
          undefined, // no imei in new request
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
