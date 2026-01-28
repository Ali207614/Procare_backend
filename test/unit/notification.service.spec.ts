import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from '../../src/notification.service';
import { NotificationGateway } from '../../src/notification.gateway';
import { Knex } from 'knex';
import { getKnexToken } from 'nestjs-knex';
import { NotFoundException } from '@nestjs/common';
import { Notification, NotificationPayload } from '../../src/common/types/notification.interface';

describe('NotificationService', () => {
  let service: NotificationService;
  let knexMock: jest.Mocked<Knex>;
  let gatewayMock: jest.Mocked<NotificationGateway>;

  const mockNotification: Notification = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    admin_id: 'admin-1',
    title: 'Test Notification',
    message: 'Test message',
    type: 'info',
    meta: {},
    is_read: false,
    read_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const mockQueryBuilder: any = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      clone: jest.fn().mockReturnThis(),
      count: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
    };

    knexMock = {
      ...mockQueryBuilder,
    } as any;

    gatewayMock = {
      broadcastToAdmins: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: getKnexToken(),
          useValue: knexMock,
        },
        {
          provide: NotificationGateway,
          useValue: gatewayMock,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('notifyAdmins', () => {
    it('should create notifications and broadcast message', async () => {
      // Arrange
      const trxMock = knexMock as any;
      const adminIds = ['admin-1', 'admin-2'];
      const payload: NotificationPayload = {
        title: 'Test Notification',
        message: 'Test message',
        type: 'info',
        meta: { repair_order_id: 'repair-1' },
      };

      trxMock.insert.mockResolvedValue([]);

      // Act
      await service.notifyAdmins(trxMock, adminIds, payload);

      // Assert
      expect(trxMock.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            admin_id: 'admin-1',
            title: 'Test Notification',
            message: 'Test message',
            type: 'info',
            meta: { repair_order_id: 'repair-1' },
          }),
          expect.objectContaining({
            admin_id: 'admin-2',
            title: 'Test Notification',
            message: 'Test message',
            type: 'info',
            meta: { repair_order_id: 'repair-1' },
          }),
        ])
      );

      expect(gatewayMock.broadcastToAdmins).toHaveBeenCalledWith(
        adminIds,
        {
          title: 'Test Notification',
          message: 'Test message',
          meta: { repair_order_id: 'repair-1' },
        }
      );
    });

    it('should use default type when not provided', async () => {
      // Arrange
      const trxMock = knexMock as any;
      const adminIds = ['admin-1'];
      const payload: NotificationPayload = {
        title: 'Test',
        message: 'Test message',
      };

      trxMock.insert.mockResolvedValue([]);

      // Act
      await service.notifyAdmins(trxMock, adminIds, payload);

      // Assert
      expect(trxMock.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'info',
            meta: {},
          }),
        ])
      );
    });
  });

  describe('findAll', () => {
    const adminId = 'admin-1';
    const query = {
      limit: 10,
      offset: 0,
      is_read: 'false',
    };

    beforeEach(() => {
      knexMock.clone.mockReturnValue(knexMock);
    });

    it('should return paginated notifications with read filter', async () => {
      // Arrange
      knexMock.andWhere.mockReturnValue(knexMock);
      knexMock.orderBy.mockReturnValue(knexMock);
      knexMock.offset.mockReturnValue(knexMock);
      knexMock.limit.mockResolvedValue([mockNotification]);
      knexMock.count.mockResolvedValue([{ count: '1' }]);

      // Act
      const result = await service.findAll(adminId, query);

      // Assert
      expect(result.rows).toEqual([mockNotification]);
      expect(result.total).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(0);
      expect(knexMock.where).toHaveBeenCalledWith({ admin_id: adminId });
      expect(knexMock.andWhere).toHaveBeenCalledWith({ is_read: false });
    });

    it('should filter by read notifications', async () => {
      // Arrange
      const readQuery = { ...query, is_read: 'true' };
      knexMock.andWhere.mockReturnValue(knexMock);
      knexMock.orderBy.mockReturnValue(knexMock);
      knexMock.offset.mockReturnValue(knexMock);
      knexMock.limit.mockResolvedValue([]);
      knexMock.count.mockResolvedValue([{ count: '0' }]);

      // Act
      await service.findAll(adminId, readQuery);

      // Assert
      expect(knexMock.andWhere).toHaveBeenCalledWith({ is_read: true });
    });

    it('should not apply read filter when not specified', async () => {
      // Arrange
      const queryWithoutFilter = { limit: 10, offset: 0 };
      knexMock.orderBy.mockReturnValue(knexMock);
      knexMock.offset.mockReturnValue(knexMock);
      knexMock.limit.mockResolvedValue([]);
      knexMock.count.mockResolvedValue([{ count: '0' }]);

      // Act
      await service.findAll(adminId, queryWithoutFilter);

      // Assert
      expect(knexMock.andWhere).not.toHaveBeenCalled();
    });

    it('should use default pagination values', async () => {
      // Arrange
      knexMock.orderBy.mockReturnValue(knexMock);
      knexMock.offset.mockReturnValue(knexMock);
      knexMock.limit.mockResolvedValue([]);
      knexMock.count.mockResolvedValue([{ count: '0' }]);

      // Act
      const result = await service.findAll(adminId, {});

      // Assert
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read successfully', async () => {
      // Arrange
      const adminId = 'admin-1';
      const notificationId = 'notification-1';
      knexMock.update.mockReturnValue(knexMock);
      knexMock.where.mockResolvedValue(1);

      // Act
      const result = await service.markAsRead(adminId, notificationId);

      // Assert
      expect(result).toEqual({ message: 'Notification marked as read' });
      expect(knexMock.update).toHaveBeenCalledWith({
        is_read: true,
        read_at: expect.any(Date),
        updated_at: expect.any(Date),
      });
      expect(knexMock.where).toHaveBeenCalledWith({
        id: notificationId,
        admin_id: adminId,
        is_read: false,
      });
    });

    it('should throw NotFoundException when notification not found', async () => {
      // Arrange
      const adminId = 'admin-1';
      const notificationId = 'non-existent';
      knexMock.update.mockReturnValue(knexMock);
      knexMock.where.mockResolvedValue(0);

      // Act & Assert
      await expect(service.markAsRead(adminId, notificationId))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read', async () => {
      // Arrange
      const adminId = 'admin-1';
      knexMock.update.mockReturnValue(knexMock);
      knexMock.where.mockResolvedValue(5);

      // Act
      const result = await service.markAllAsRead(adminId);

      // Assert
      expect(result).toEqual({ message: 'All notifications marked as read' });
      expect(knexMock.update).toHaveBeenCalledWith({
        is_read: true,
        read_at: expect.any(Date),
        updated_at: expect.any(Date),
      });
      expect(knexMock.where).toHaveBeenCalledWith({
        admin_id: adminId,
        is_read: false,
      });
    });
  });
});