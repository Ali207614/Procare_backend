import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { NotificationService } from '../src/notification/notification.service';
import { AppModule } from '../src/app.module';
import { AdminFactory } from './factories/admin.factory';
import { UserFactory } from './factories/user.factory';
import { NotificationFactory } from './factories/notification.factory';
import { TestHelpers } from './utils/test-helpers';

describe('NotificationService (Integration)', () => {
  let app: INestApplication;
  let service: NotificationService;
  let knex: any;
  let redis: any;
  let adminData: any;
  let userData: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    service = moduleFixture.get<NotificationService>(NotificationService);
    knex = moduleFixture.get('KnexConnection');
    redis = moduleFixture.get('RedisClient');

    adminData = await AdminFactory.create(knex);
    userData = await UserFactory.create(knex);
  });

  beforeEach(async () => {
    await TestHelpers.cleanNotificationsTable(knex);
    await redis.flushall();
  });

  afterAll(async () => {
    await TestHelpers.cleanDatabase(knex);
    await app.close();
  });

  describe('findAll', () => {
    it('should retrieve all notifications with pagination', async () => {
      // Arrange
      const notifications = await NotificationFactory.createMany(knex, 5, {
        recipient_id: userData.id,
      });

      // Act
      const result = await service.findAll({ limit: 3, offset: 0 });

      // Assert
      expect(result.data).toHaveLength(3);
      expect(result.meta.total).toBe(5);
      expect(result.meta.limit).toBe(3);
      expect(result.meta.offset).toBe(0);
    });

    it('should filter notifications by recipient', async () => {
      // Arrange
      const user2 = await UserFactory.create(knex);

      await NotificationFactory.create(knex, { recipient_id: userData.id });
      await NotificationFactory.create(knex, { recipient_id: user2.id });
      await NotificationFactory.create(knex, { recipient_id: userData.id });

      // Act
      const result = await service.findAll({ recipient_id: userData.id });

      // Assert
      expect(result.data).toHaveLength(2);
      expect(result.data.every((n) => n.recipient_id === userData.id)).toBe(true);
    });

    it('should filter notifications by type', async () => {
      // Arrange
      await NotificationFactory.create(knex, {
        type: 'SMS',
        recipient_id: userData.id,
      });
      await NotificationFactory.create(knex, {
        type: 'Email',
        recipient_id: userData.id,
      });
      await NotificationFactory.create(knex, {
        type: 'SMS',
        recipient_id: userData.id,
      });

      // Act
      const result = await service.findAll({ type: 'SMS' });

      // Assert
      expect(result.data).toHaveLength(2);
      expect(result.data.every((n) => n.type === 'SMS')).toBe(true);
    });

    it('should filter notifications by status', async () => {
      // Arrange
      await NotificationFactory.create(knex, {
        status: 'Sent',
        recipient_id: userData.id,
      });
      await NotificationFactory.create(knex, {
        status: 'Failed',
        recipient_id: userData.id,
      });
      await NotificationFactory.create(knex, {
        status: 'Pending',
        recipient_id: userData.id,
      });

      // Act
      const result = await service.findAll({ status: 'Sent' });

      // Assert
      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe('Sent');
    });
  });

  describe('create', () => {
    it('should create SMS notification successfully', async () => {
      // Arrange
      const notificationDto = NotificationFactory.createDto({
        type: 'SMS',
        recipient_id: userData.id,
        message: 'Test SMS message',
        phone_number: userData.phone_number,
      });

      // Act
      const result = await service.create(notificationDto, adminData.id);

      // Assert
      expect(result.message).toBe('Notification created successfully');

      const notification = await knex('notifications')
        .where({ recipient_id: userData.id, type: 'SMS' })
        .first();

      expect(notification).toBeDefined();
      expect(notification.message).toBe('Test SMS message');
      expect(notification.phone_number).toBe(userData.phone_number);
      expect(notification.status).toBe('Pending');
      expect(notification.created_by).toBe(adminData.id);
    });

    it('should create Email notification successfully', async () => {
      // Arrange
      const notificationDto = NotificationFactory.createDto({
        type: 'Email',
        recipient_id: userData.id,
        subject: 'Test Email Subject',
        message: 'Test email content',
        email: userData.email,
      });

      // Act
      const result = await service.create(notificationDto, adminData.id);

      // Assert
      expect(result.message).toBe('Notification created successfully');

      const notification = await knex('notifications')
        .where({ recipient_id: userData.id, type: 'Email' })
        .first();

      expect(notification.subject).toBe('Test Email Subject');
      expect(notification.message).toBe('Test email content');
      expect(notification.email).toBe(userData.email);
    });

    it('should create Telegram notification successfully', async () => {
      // Arrange
      const notificationDto = NotificationFactory.createDto({
        type: 'Telegram',
        recipient_id: userData.id,
        message: 'Test Telegram message',
        telegram_chat_id: userData.telegram_chat_id,
      });

      // Act
      const result = await service.create(notificationDto, adminData.id);

      // Assert
      expect(result.message).toBe('Notification created successfully');

      const notification = await knex('notifications')
        .where({ recipient_id: userData.id, type: 'Telegram' })
        .first();

      expect(notification.message).toBe('Test Telegram message');
      expect(notification.telegram_chat_id).toBe(userData.telegram_chat_id);
    });

    it('should validate required fields for SMS', async () => {
      // Arrange
      const notificationDto = NotificationFactory.createDto({
        type: 'SMS',
        recipient_id: userData.id,
        message: 'Test message',
        // Missing phone_number
      });

      // Act & Assert
      await expect(service.create(notificationDto, adminData.id)).rejects.toThrow(
        'Phone number is required for SMS notifications',
      );
    });

    it('should validate required fields for Email', async () => {
      // Arrange
      const notificationDto = NotificationFactory.createDto({
        type: 'Email',
        recipient_id: userData.id,
        message: 'Test message',
        // Missing email and subject
      });

      // Act & Assert
      await expect(service.create(notificationDto, adminData.id)).rejects.toThrow(
        'Email and subject are required for Email notifications',
      );
    });
  });

  describe('findOne', () => {
    it('should retrieve notification by id', async () => {
      // Arrange
      const notification = await NotificationFactory.create(knex, {
        recipient_id: userData.id,
      });

      // Act
      const result = await service.findOne(notification.id);

      // Assert
      expect(result.data.id).toBe(notification.id);
      expect(result.data.type).toBe(notification.type);
      expect(result.data.message).toBe(notification.message);
      expect(result.data.recipient_id).toBe(userData.id);
    });

    it('should throw error for non-existent notification', async () => {
      // Act & Assert
      await expect(service.findOne('non-existent-id')).rejects.toThrow('Notification not found');
    });
  });

  describe('update', () => {
    it('should update notification successfully', async () => {
      // Arrange
      const notification = await NotificationFactory.create(knex, {
        status: 'Pending',
        recipient_id: userData.id,
      });

      const updateDto = {
        message: 'Updated message content',
        status: 'Sent',
      };

      // Act
      const result = await service.update(notification.id, updateDto, adminData.id);

      // Assert
      expect(result.message).toBe('Notification updated successfully');

      const updatedNotification = await knex('notifications')
        .where({ id: notification.id })
        .first();

      expect(updatedNotification.message).toBe('Updated message content');
      expect(updatedNotification.status).toBe('Sent');
      expect(updatedNotification.updated_by).toBe(adminData.id);
    });

    it('should not allow updating sent notification content', async () => {
      // Arrange
      const notification = await NotificationFactory.create(knex, {
        status: 'Sent',
        recipient_id: userData.id,
      });

      // Act & Assert
      await expect(
        service.update(notification.id, { message: 'New message' }, adminData.id),
      ).rejects.toThrow('Cannot update content of sent notification');
    });
  });

  describe('markAsDelivered', () => {
    it('should mark notification as delivered', async () => {
      // Arrange
      const notification = await NotificationFactory.create(knex, {
        status: 'Sent',
        recipient_id: userData.id,
      });

      // Act
      const result = await service.markAsDelivered(notification.id, adminData.id);

      // Assert
      expect(result.message).toBe('Notification marked as delivered');

      const updatedNotification = await knex('notifications')
        .where({ id: notification.id })
        .first();

      expect(updatedNotification.status).toBe('Delivered');
      expect(updatedNotification.delivered_at).toBeDefined();
      expect(updatedNotification.updated_by).toBe(adminData.id);
    });

    it('should not mark pending notification as delivered', async () => {
      // Arrange
      const notification = await NotificationFactory.create(knex, {
        status: 'Pending',
        recipient_id: userData.id,
      });

      // Act & Assert
      await expect(service.markAsDelivered(notification.id, adminData.id)).rejects.toThrow(
        'Can only mark sent notifications as delivered',
      );
    });
  });

  describe('markAsFailed', () => {
    it('should mark notification as failed with reason', async () => {
      // Arrange
      const notification = await NotificationFactory.create(knex, {
        status: 'Pending',
        recipient_id: userData.id,
      });

      const failureReason = 'Invalid phone number';

      // Act
      const result = await service.markAsFailed(notification.id, failureReason, adminData.id);

      // Assert
      expect(result.message).toBe('Notification marked as failed');

      const updatedNotification = await knex('notifications')
        .where({ id: notification.id })
        .first();

      expect(updatedNotification.status).toBe('Failed');
      expect(updatedNotification.failure_reason).toBe(failureReason);
      expect(updatedNotification.updated_by).toBe(adminData.id);
    });
  });

  describe('getNotificationsByUser', () => {
    it('should retrieve notifications for a user', async () => {
      // Arrange
      const user2 = await UserFactory.create(knex);

      await NotificationFactory.create(knex, { recipient_id: userData.id });
      await NotificationFactory.create(knex, { recipient_id: userData.id });
      await NotificationFactory.create(knex, { recipient_id: user2.id });

      // Act
      const result = await service.getNotificationsByUser(userData.id, { limit: 10, offset: 0 });

      // Assert
      expect(result.data).toHaveLength(2);
      expect(result.data.every((n) => n.recipient_id === userData.id)).toBe(true);
    });

    it('should cache user notifications', async () => {
      // Arrange
      await NotificationFactory.create(knex, { recipient_id: userData.id });

      // Act
      await service.getNotificationsByUser(userData.id, { limit: 10, offset: 0 });
      const result = await service.getNotificationsByUser(userData.id, { limit: 10, offset: 0 });

      // Assert
      expect(result.data).toHaveLength(1);

      const cacheKey = `notifications:user:${userData.id}:10:0`;
      const cachedData = await redis.get(cacheKey);
      expect(cachedData).toBeDefined();
    });
  });

  describe('getNotificationStats', () => {
    it('should return notification statistics', async () => {
      // Arrange
      await NotificationFactory.create(knex, {
        type: 'SMS',
        status: 'Sent',
        recipient_id: userData.id,
      });
      await NotificationFactory.create(knex, {
        type: 'Email',
        status: 'Delivered',
        recipient_id: userData.id,
      });
      await NotificationFactory.create(knex, {
        type: 'Telegram',
        status: 'Failed',
        recipient_id: userData.id,
      });
      await NotificationFactory.create(knex, {
        type: 'SMS',
        status: 'Pending',
        recipient_id: userData.id,
      });

      // Act
      const result = await service.getNotificationStats();

      // Assert
      expect(result.data.total_notifications).toBe(4);
      expect(result.data.sent_notifications).toBe(1);
      expect(result.data.delivered_notifications).toBe(1);
      expect(result.data.failed_notifications).toBe(1);
      expect(result.data.pending_notifications).toBe(1);
      expect(result.data.sms_notifications).toBe(2);
      expect(result.data.email_notifications).toBe(1);
      expect(result.data.telegram_notifications).toBe(1);
    });

    it('should cache notification stats', async () => {
      // Arrange
      await NotificationFactory.create(knex, { recipient_id: userData.id });

      // Act
      await service.getNotificationStats();
      const result = await service.getNotificationStats();

      // Assert
      const cacheKey = 'notifications:stats';
      const cachedData = await redis.get(cacheKey);
      expect(cachedData).toBeDefined();
    });
  });

  describe('resendNotification', () => {
    it('should resend failed notification', async () => {
      // Arrange
      const notification = await NotificationFactory.create(knex, {
        status: 'Failed',
        recipient_id: userData.id,
      });

      // Act
      const result = await service.resendNotification(notification.id, adminData.id);

      // Assert
      expect(result.message).toBe('Notification queued for resending');

      const updatedNotification = await knex('notifications')
        .where({ id: notification.id })
        .first();

      expect(updatedNotification.status).toBe('Pending');
      expect(updatedNotification.failure_reason).toBeNull();
      expect(updatedNotification.updated_by).toBe(adminData.id);
    });

    it('should not resend delivered notification', async () => {
      // Arrange
      const notification = await NotificationFactory.create(knex, {
        status: 'Delivered',
        recipient_id: userData.id,
      });

      // Act & Assert
      await expect(service.resendNotification(notification.id, adminData.id)).rejects.toThrow(
        'Can only resend failed notifications',
      );
    });
  });
});
