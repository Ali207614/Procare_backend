import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from '../../src/notification/notification.service';
import { NotificationFactory } from '../factories/notification.factory';
import { UserFactory } from '../factories/user.factory';
import { AdminFactory } from '../factories/admin.factory';

describe('NotificationService', () => {
  let service: NotificationService;
  let mockKnex: any;
  let mockRedis: any;
  let mockTelegramService: any;
  let mockEmailService: any;
  let mockSmsService: any;

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
      insert: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      transaction: jest.fn(),
      raw: jest.fn(),
    };

    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
    };

    mockTelegramService = {
      sendMessage: jest.fn(),
    };

    mockEmailService = {
      sendEmail: jest.fn(),
    };

    mockSmsService = {
      sendSms: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: 'KnexConnection', useValue: mockKnex },
        { provide: 'RedisClient', useValue: mockRedis },
        { provide: 'TelegramService', useValue: mockTelegramService },
        { provide: 'EmailService', useValue: mockEmailService },
        { provide: 'SmsService', useValue: mockSmsService },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return notifications with pagination', async () => {
      // Arrange
      const mockNotifications = NotificationFactory.createMany(3);
      const mockCount = [{ count: '5' }];

      mockKnex.count.mockResolvedValueOnce(mockCount);
      mockKnex.first.mockResolvedValueOnce(mockNotifications);

      // Act
      const result = await service.findAll({ limit: 3, offset: 0 });

      // Assert
      expect(result.data).toEqual(mockNotifications);
      expect(result.meta.total).toBe(5);
    });

    it('should filter by recipient', async () => {
      // Arrange
      const userId = 'user-123';
      const mockNotifications = [NotificationFactory.create({ recipient_id: userId })];
      const mockCount = [{ count: '1' }];

      mockKnex.count.mockResolvedValueOnce(mockCount);
      mockKnex.first.mockResolvedValueOnce(mockNotifications);

      // Act
      const result = await service.findAll({ recipient_id: userId });

      // Assert
      expect(mockKnex.where).toHaveBeenCalledWith('notifications.recipient_id', userId);
    });

    it('should filter by type', async () => {
      // Arrange
      const mockNotifications = [NotificationFactory.create({ type: 'SMS' })];
      const mockCount = [{ count: '1' }];

      mockKnex.count.mockResolvedValueOnce(mockCount);
      mockKnex.first.mockResolvedValueOnce(mockNotifications);

      // Act
      const result = await service.findAll({ type: 'SMS' });

      // Assert
      expect(mockKnex.where).toHaveBeenCalledWith('notifications.type', 'SMS');
    });

    it('should filter by status', async () => {
      // Arrange
      const mockNotifications = [NotificationFactory.create({ status: 'Sent' })];
      const mockCount = [{ count: '1' }];

      mockKnex.count.mockResolvedValueOnce(mockCount);
      mockKnex.first.mockResolvedValueOnce(mockNotifications);

      // Act
      const result = await service.findAll({ status: 'Sent' });

      // Assert
      expect(mockKnex.where).toHaveBeenCalledWith('notifications.status', 'Sent');
    });
  });

  describe('create', () => {
    it('should create SMS notification successfully', async () => {
      // Arrange
      const userData = UserFactory.create();
      const notificationDto = NotificationFactory.createDto({
        type: 'SMS',
        recipient_id: userData.id,
        message: 'Test SMS message',
        phone_number: userData.phone_number,
      });
      const adminId = 'admin-123';
      const mockInsertId = ['notification-123'];

      mockKnex.insert.mockResolvedValueOnce(mockInsertId);

      // Act
      const result = await service.create(notificationDto, adminId);

      // Assert
      expect(result.message).toBe('Notification created successfully');
      expect(result.notification_id).toBe(mockInsertId[0]);
      expect(mockKnex.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SMS',
          message: 'Test SMS message',
          phone_number: userData.phone_number,
          status: 'Pending',
          created_by: adminId,
        }),
      );
    });

    it('should create Email notification successfully', async () => {
      // Arrange
      const userData = UserFactory.create();
      const notificationDto = NotificationFactory.createDto({
        type: 'Email',
        recipient_id: userData.id,
        subject: 'Test Email Subject',
        message: 'Test email content',
        email: userData.email,
      });
      const adminId = 'admin-123';
      const mockInsertId = ['notification-123'];

      mockKnex.insert.mockResolvedValueOnce(mockInsertId);

      // Act
      const result = await service.create(notificationDto, adminId);

      // Assert
      expect(mockKnex.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'Email',
          subject: 'Test Email Subject',
          message: 'Test email content',
          email: userData.email,
        }),
      );
    });

    it('should create Telegram notification successfully', async () => {
      // Arrange
      const userData = UserFactory.create();
      const notificationDto = NotificationFactory.createDto({
        type: 'Telegram',
        recipient_id: userData.id,
        message: 'Test Telegram message',
        telegram_chat_id: userData.telegram_chat_id,
      });
      const adminId = 'admin-123';
      const mockInsertId = ['notification-123'];

      mockKnex.insert.mockResolvedValueOnce(mockInsertId);

      // Act
      const result = await service.create(notificationDto, adminId);

      // Assert
      expect(mockKnex.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'Telegram',
          message: 'Test Telegram message',
          telegram_chat_id: userData.telegram_chat_id,
        }),
      );
    });

    it('should validate required fields for SMS', async () => {
      // Arrange
      const notificationDto = NotificationFactory.createDto({
        type: 'SMS',
        recipient_id: 'user-123',
        message: 'Test message',
        // Missing phone_number
      });

      // Act & Assert
      await expect(service.create(notificationDto, 'admin-123')).rejects.toThrow(
        'Phone number is required for SMS notifications',
      );
    });

    it('should validate required fields for Email', async () => {
      // Arrange
      const notificationDto = NotificationFactory.createDto({
        type: 'Email',
        recipient_id: 'user-123',
        message: 'Test message',
        // Missing email and subject
      });

      // Act & Assert
      await expect(service.create(notificationDto, 'admin-123')).rejects.toThrow(
        'Email and subject are required for Email notifications',
      );
    });
  });

  describe('findOne', () => {
    it('should return notification by id', async () => {
      // Arrange
      const notificationId = 'notification-123';
      const mockNotification = NotificationFactory.create({ id: notificationId });

      mockKnex.first.mockResolvedValueOnce(mockNotification);

      // Act
      const result = await service.findOne(notificationId);

      // Assert
      expect(result.data).toEqual(mockNotification);
      expect(mockKnex.where).toHaveBeenCalledWith('notifications.id', notificationId);
    });

    it('should throw error for non-existent notification', async () => {
      // Arrange
      mockKnex.first.mockResolvedValueOnce(null);

      // Act & Assert
      await expect(service.findOne('non-existent-id')).rejects.toThrow('Notification not found');
    });
  });

  describe('update', () => {
    it('should update notification successfully', async () => {
      // Arrange
      const notificationId = 'notification-123';
      const updateDto = {
        message: 'Updated message content',
        status: 'Sent',
      };
      const adminId = 'admin-123';
      const mockNotification = NotificationFactory.create({
        id: notificationId,
        status: 'Pending',
      });

      mockKnex.first.mockResolvedValueOnce(mockNotification);
      mockKnex.update.mockResolvedValueOnce(1);

      // Act
      const result = await service.update(notificationId, updateDto, adminId);

      // Assert
      expect(result.message).toBe('Notification updated successfully');
      expect(mockKnex.update).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Updated message content',
          status: 'Sent',
          updated_by: adminId,
        }),
      );
    });

    it('should not allow updating sent notification content', async () => {
      // Arrange
      const notificationId = 'notification-123';
      const updateDto = { message: 'New message' };
      const mockNotification = NotificationFactory.create({
        id: notificationId,
        status: 'Sent',
      });

      mockKnex.first.mockResolvedValueOnce(mockNotification);

      // Act & Assert
      await expect(service.update(notificationId, updateDto, 'admin-123')).rejects.toThrow(
        'Cannot update content of sent notification',
      );
    });
  });

  describe('markAsDelivered', () => {
    it('should mark notification as delivered', async () => {
      // Arrange
      const notificationId = 'notification-123';
      const adminId = 'admin-123';
      const mockNotification = NotificationFactory.create({
        id: notificationId,
        status: 'Sent',
      });

      mockKnex.first.mockResolvedValueOnce(mockNotification);
      mockKnex.update.mockResolvedValueOnce(1);

      // Act
      const result = await service.markAsDelivered(notificationId, adminId);

      // Assert
      expect(result.message).toBe('Notification marked as delivered');
      expect(mockKnex.update).toHaveBeenCalledWith({
        status: 'Delivered',
        delivered_at: expect.any(Date),
        updated_by: adminId,
      });
    });

    it('should not mark pending notification as delivered', async () => {
      // Arrange
      const notificationId = 'notification-123';
      const mockNotification = NotificationFactory.create({
        id: notificationId,
        status: 'Pending',
      });

      mockKnex.first.mockResolvedValueOnce(mockNotification);

      // Act & Assert
      await expect(service.markAsDelivered(notificationId, 'admin-123')).rejects.toThrow(
        'Can only mark sent notifications as delivered',
      );
    });
  });

  describe('markAsFailed', () => {
    it('should mark notification as failed with reason', async () => {
      // Arrange
      const notificationId = 'notification-123';
      const failureReason = 'Invalid phone number';
      const adminId = 'admin-123';
      const mockNotification = NotificationFactory.create({
        id: notificationId,
        status: 'Pending',
      });

      mockKnex.first.mockResolvedValueOnce(mockNotification);
      mockKnex.update.mockResolvedValueOnce(1);

      // Act
      const result = await service.markAsFailed(notificationId, failureReason, adminId);

      // Assert
      expect(result.message).toBe('Notification marked as failed');
      expect(mockKnex.update).toHaveBeenCalledWith({
        status: 'Failed',
        failure_reason: failureReason,
        updated_by: adminId,
      });
    });
  });

  describe('getNotificationsByUser', () => {
    it('should retrieve notifications for a user', async () => {
      // Arrange
      const userId = 'user-123';
      const mockNotifications = NotificationFactory.createMany(2);
      const mockCount = [{ count: '2' }];

      mockKnex.count.mockResolvedValueOnce(mockCount);
      mockKnex.first.mockResolvedValueOnce(mockNotifications);

      // Act
      const result = await service.getNotificationsByUser(userId, { limit: 10, offset: 0 });

      // Assert
      expect(result.data).toEqual(mockNotifications);
      expect(result.meta.total).toBe(2);
      expect(mockKnex.where).toHaveBeenCalledWith('notifications.recipient_id', userId);
    });

    it('should cache user notifications', async () => {
      // Arrange
      const userId = 'user-123';
      const mockNotifications = NotificationFactory.createMany(1);
      const mockCount = [{ count: '1' }];

      mockRedis.get.mockResolvedValueOnce(null);
      mockKnex.count.mockResolvedValueOnce(mockCount);
      mockKnex.first.mockResolvedValueOnce(mockNotifications);

      // Act
      await service.getNotificationsByUser(userId, { limit: 10, offset: 0 });

      // Assert
      expect(mockRedis.set).toHaveBeenCalledWith(
        `notifications:user:${userId}:10:0`,
        expect.any(String),
        'EX',
        600,
      );
    });
  });

  describe('getNotificationStats', () => {
    it('should return notification statistics', async () => {
      // Arrange
      const mockStats = [
        { status: 'Sent', count: '10' },
        { status: 'Delivered', count: '8' },
        { status: 'Failed', count: '2' },
        { status: 'Pending', count: '5' },
      ];

      const mockTypeStats = [
        { type: 'SMS', count: '15' },
        { type: 'Email', count: '7' },
        { type: 'Telegram', count: '3' },
      ];

      mockKnex.raw
        .mockResolvedValueOnce({ rows: mockStats })
        .mockResolvedValueOnce({ rows: mockTypeStats });

      // Act
      const result = await service.getNotificationStats();

      // Assert
      expect(result.data.total_notifications).toBe(25);
      expect(result.data.sent_notifications).toBe(10);
      expect(result.data.delivered_notifications).toBe(8);
      expect(result.data.failed_notifications).toBe(2);
      expect(result.data.pending_notifications).toBe(5);
      expect(result.data.sms_notifications).toBe(15);
      expect(result.data.email_notifications).toBe(7);
      expect(result.data.telegram_notifications).toBe(3);
    });

    it('should cache notification stats', async () => {
      // Arrange
      const mockStats = [{ status: 'Sent', count: '10' }];
      const mockTypeStats = [{ type: 'SMS', count: '10' }];

      mockRedis.get.mockResolvedValueOnce(null);
      mockKnex.raw
        .mockResolvedValueOnce({ rows: mockStats })
        .mockResolvedValueOnce({ rows: mockTypeStats });

      // Act
      await service.getNotificationStats();

      // Assert
      expect(mockRedis.set).toHaveBeenCalledWith(
        'notifications:stats',
        expect.any(String),
        'EX',
        1800,
      );
    });
  });

  describe('resendNotification', () => {
    it('should resend failed notification', async () => {
      // Arrange
      const notificationId = 'notification-123';
      const adminId = 'admin-123';
      const mockNotification = NotificationFactory.create({
        id: notificationId,
        status: 'Failed',
      });

      mockKnex.first.mockResolvedValueOnce(mockNotification);
      mockKnex.update.mockResolvedValueOnce(1);

      // Act
      const result = await service.resendNotification(notificationId, adminId);

      // Assert
      expect(result.message).toBe('Notification queued for resending');
      expect(mockKnex.update).toHaveBeenCalledWith({
        status: 'Pending',
        failure_reason: null,
        updated_by: adminId,
      });
    });

    it('should not resend delivered notification', async () => {
      // Arrange
      const notificationId = 'notification-123';
      const mockNotification = NotificationFactory.create({
        id: notificationId,
        status: 'Delivered',
      });

      mockKnex.first.mockResolvedValueOnce(mockNotification);

      // Act & Assert
      await expect(service.resendNotification(notificationId, 'admin-123')).rejects.toThrow(
        'Can only resend failed notifications',
      );
    });
  });

  describe('sendNotification', () => {
    it('should send SMS notification', async () => {
      // Arrange
      const notificationId = 'notification-123';
      const mockNotification = NotificationFactory.create({
        id: notificationId,
        type: 'SMS',
        phone_number: '+1234567890',
        message: 'Test SMS',
      });

      mockKnex.first.mockResolvedValueOnce(mockNotification);
      mockSmsService.sendSms.mockResolvedValueOnce({ success: true });
      mockKnex.update.mockResolvedValueOnce(1);

      // Act
      const result = await service.sendNotification(notificationId);

      // Assert
      expect(result.message).toBe('Notification sent successfully');
      expect(mockSmsService.sendSms).toHaveBeenCalledWith('+1234567890', 'Test SMS');
      expect(mockKnex.update).toHaveBeenCalledWith({
        status: 'Sent',
        sent_at: expect.any(Date),
      });
    });

    it('should send Email notification', async () => {
      // Arrange
      const notificationId = 'notification-123';
      const mockNotification = NotificationFactory.create({
        id: notificationId,
        type: 'Email',
        email: 'test@example.com',
        subject: 'Test Subject',
        message: 'Test Email',
      });

      mockKnex.first.mockResolvedValueOnce(mockNotification);
      mockEmailService.sendEmail.mockResolvedValueOnce({ success: true });
      mockKnex.update.mockResolvedValueOnce(1);

      // Act
      const result = await service.sendNotification(notificationId);

      // Assert
      expect(result.message).toBe('Notification sent successfully');
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith({
        to: 'test@example.com',
        subject: 'Test Subject',
        message: 'Test Email',
      });
    });

    it('should send Telegram notification', async () => {
      // Arrange
      const notificationId = 'notification-123';
      const mockNotification = NotificationFactory.create({
        id: notificationId,
        type: 'Telegram',
        telegram_chat_id: '123456789',
        message: 'Test Telegram',
      });

      mockKnex.first.mockResolvedValueOnce(mockNotification);
      mockTelegramService.sendMessage.mockResolvedValueOnce({ success: true });
      mockKnex.update.mockResolvedValueOnce(1);

      // Act
      const result = await service.sendNotification(notificationId);

      // Assert
      expect(result.message).toBe('Notification sent successfully');
      expect(mockTelegramService.sendMessage).toHaveBeenCalledWith('123456789', 'Test Telegram');
    });

    it('should handle send failure', async () => {
      // Arrange
      const notificationId = 'notification-123';
      const mockNotification = NotificationFactory.create({
        id: notificationId,
        type: 'SMS',
        phone_number: '+1234567890',
        message: 'Test SMS',
      });

      mockKnex.first.mockResolvedValueOnce(mockNotification);
      mockSmsService.sendSms.mockRejectedValueOnce(new Error('SMS service error'));
      mockKnex.update.mockResolvedValueOnce(1);

      // Act
      const result = await service.sendNotification(notificationId);

      // Assert
      expect(result.message).toBe('Notification send failed');
      expect(mockKnex.update).toHaveBeenCalledWith({
        status: 'Failed',
        failure_reason: 'SMS service error',
      });
    });
  });

  describe('bulkSend', () => {
    it('should send multiple notifications', async () => {
      // Arrange
      const notificationIds = ['notif-1', 'notif-2', 'notif-3'];
      const adminId = 'admin-123';

      jest.spyOn(service, 'sendNotification').mockResolvedValue({ message: 'Sent' });

      // Act
      const result = await service.bulkSend(notificationIds, adminId);

      // Assert
      expect(result.message).toBe('Bulk send initiated');
      expect(result.processed_count).toBe(3);
      expect(service.sendNotification).toHaveBeenCalledTimes(3);
    });
  });
});
