import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { NotificationService } from '../src/notification/notification.service';
import { AuthService } from '../src/auth/auth.service';
import { TestModuleBuilder } from './utils/test-module-builder';
import { CoverageHelpers } from './utils/coverage-helpers';

describe('Notifications Controller Complete E2E', () => {
  let app: INestApplication;
  let authService: AuthService;
  let notificationService: NotificationService;
  let knex: any;
  let redis: any;
  let adminToken: string;
  let secondAdminToken: string;
  let testAdmin: any;
  let secondTestAdmin: any;
  let testBranch: any;
  let testNotifications: any[];

  beforeAll(async () => {
    const moduleBuilder = new TestModuleBuilder();
    const module: TestingModule = await moduleBuilder
      .withRealDatabase()
      .withRealRedis()
      .withExternalServiceMocks()
      .build();

    app = module.createNestApplication();
    await app.init();

    // Get services
    authService = module.get<AuthService>(AuthService);
    notificationService = module.get<NotificationService>(NotificationService);
    knex = module.get('KNEX_CONNECTION');
    redis = module.get('REDIS_CLIENT');

    // Clean database and cache
    await knex.raw('DELETE FROM notifications');
    await knex.raw('DELETE FROM admin_role_permissions');
    await knex.raw('DELETE FROM role_permissions');
    await knex.raw('DELETE FROM admin_roles');
    await knex.raw('DELETE FROM admins');
    await knex.raw('DELETE FROM roles');
    await knex.raw('DELETE FROM permissions');
    await knex.raw('DELETE FROM branches');
    await redis.flushall();

    // Setup test data
    await setupTestData();
  });

  afterAll(async () => {
    // Clean up
    await knex.raw('DELETE FROM notifications');
    await knex.raw('DELETE FROM admin_role_permissions');
    await knex.raw('DELETE FROM role_permissions');
    await knex.raw('DELETE FROM admin_roles');
    await knex.raw('DELETE FROM admins');
    await knex.raw('DELETE FROM roles');
    await knex.raw('DELETE FROM permissions');
    await knex.raw('DELETE FROM branches');
    await redis.flushall();
    await app.close();
  });

  async function setupTestData() {
    // Create test branch
    testBranch = await knex('branches')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        name: 'Test Branch',
        address: 'Test Address',
        phone: '+998901234567',
        status: 'Open',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    testBranch = testBranch[0];

    // Create basic permissions for testing
    const permissions = ['notification.view', 'notification.manage'];

    for (const permission of permissions) {
      await knex('permissions').insert({
        id: knex.raw('gen_random_uuid()'),
        name: permission,
        description: `Permission for ${permission}`,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    // Create test role
    const testRole = await knex('roles')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        name: 'Test Role',
        description: 'Role for testing',
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    const role = testRole[0];

    // Assign permissions to role
    const allPermissions = await knex('permissions').select('*');
    for (const permission of allPermissions) {
      await knex('role_permissions').insert({
        id: knex.raw('gen_random_uuid()'),
        role_id: role.id,
        permission_id: permission.id,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    // Create test admins
    testAdmin = await knex('admins')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        first_name: 'Test',
        last_name: 'Admin',
        phone: '+998901111111',
        login: 'testadmin',
        password: '$2b$10$K7L/VxwjnydKw.fK8tUqme7kk7IgJ9J9J9J9J9J9J9J9J9J9J9J9',
        branch_id: testBranch.id,
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    testAdmin = testAdmin[0];

    secondTestAdmin = await knex('admins')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        first_name: 'Second',
        last_name: 'Admin',
        phone: '+998902222222',
        login: 'secondadmin',
        password: '$2b$10$K7L/VxwjnydKw.fK8tUqme7kk7IgJ9J9J9J9J9J9J9J9J9J9J9J9',
        branch_id: testBranch.id,
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    secondTestAdmin = secondTestAdmin[0];

    // Assign roles to admins
    await knex('admin_roles').insert({
      id: knex.raw('gen_random_uuid()'),
      admin_id: testAdmin.id,
      role_id: role.id,
      created_at: new Date(),
      updated_at: new Date(),
    });

    await knex('admin_roles').insert({
      id: knex.raw('gen_random_uuid()'),
      admin_id: secondTestAdmin.id,
      role_id: role.id,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Create test notifications
    testNotifications = [];
    for (let i = 1; i <= 10; i++) {
      const notification = await knex('notifications')
        .insert({
          id: knex.raw('gen_random_uuid()'),
          admin_id: testAdmin.id,
          title: `Notification ${i}`,
          message: `This is test notification number ${i}`,
          type: i % 3 === 0 ? 'system' : i % 2 === 0 ? 'repair_order' : 'general',
          is_read: i <= 3, // First 3 notifications are read
          created_at: new Date(Date.now() - i * 3600000), // Different timestamps
          updated_at: new Date(),
        })
        .returning('*');
      testNotifications.push(notification[0]);
    }

    // Create notifications for second admin
    for (let i = 1; i <= 3; i++) {
      await knex('notifications').insert({
        id: knex.raw('gen_random_uuid()'),
        admin_id: secondTestAdmin.id,
        title: `Second Admin Notification ${i}`,
        message: `This is notification for second admin ${i}`,
        type: 'general',
        is_read: false,
        created_at: new Date(Date.now() - i * 7200000),
        updated_at: new Date(),
      });
    }

    // Generate tokens
    adminToken = authService.generateJwtToken({
      id: testAdmin.id,
      login: testAdmin.login,
      first_name: testAdmin.first_name,
      last_name: testAdmin.last_name,
      phone: testAdmin.phone,
      branch_id: testAdmin.branch_id,
      status: testAdmin.status,
    });

    secondAdminToken = authService.generateJwtToken({
      id: secondTestAdmin.id,
      login: secondTestAdmin.login,
      first_name: secondTestAdmin.first_name,
      last_name: secondTestAdmin.last_name,
      phone: secondTestAdmin.phone,
      branch_id: secondTestAdmin.branch_id,
      status: secondTestAdmin.status,
    });
  }

  describe('GET /api/v1/notifications (Get All Notifications)', () => {
    it('should return all notifications for current admin with default pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        data: expect.any(Array),
        meta: {
          total: expect.any(Number),
          limit: expect.any(Number),
          offset: expect.any(Number),
        },
      });

      expect(response.body.data.length).toBe(10); // All notifications for test admin
      expect(response.body.meta.total).toBe(10);

      // Verify notification structure
      const notification = response.body.data[0];
      expect(notification).toMatchObject({
        id: expect.any(String),
        title: expect.any(String),
        message: expect.any(String),
        type: expect.any(String),
        is_read: expect.any(Boolean),
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });
    });

    it('should filter notifications by read status (unread)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/notifications?is_read=false')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.length).toBe(7); // 7 unread notifications
      expect(response.body.meta.total).toBe(7);

      // All returned notifications should be unread
      response.body.data.forEach((notification) => {
        expect(notification.is_read).toBe(false);
      });
    });

    it('should filter notifications by read status (read)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/notifications?is_read=true')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.length).toBe(3); // 3 read notifications
      expect(response.body.meta.total).toBe(3);

      // All returned notifications should be read
      response.body.data.forEach((notification) => {
        expect(notification.is_read).toBe(true);
      });
    });

    it('should paginate notifications correctly', async () => {
      const limit = 5;
      const offset = 2;

      const response = await request(app.getHttpServer())
        .get(`/api/v1/notifications?limit=${limit}&offset=${offset}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.meta.limit).toBe(limit);
      expect(response.body.meta.offset).toBe(offset);
      expect(response.body.data.length).toBe(limit);
      expect(response.body.meta.total).toBe(10);
    });

    it('should return notifications ordered by creation date (newest first)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const dates = response.body.data.map((notification) => new Date(notification.created_at));
      const sortedDates = [...dates].sort((a, b) => b.getTime() - a.getTime());
      expect(dates).toEqual(sortedDates);
    });

    it('should handle combined filters and pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/notifications?is_read=false&limit=3&offset=1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.length).toBe(3);
      expect(response.body.meta.total).toBe(7); // Total unread notifications
      response.body.data.forEach((notification) => {
        expect(notification.is_read).toBe(false);
      });
    });

    it('should return only notifications for current admin', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${secondAdminToken}`)
        .expect(200);

      expect(response.body.data.length).toBe(3); // Only notifications for second admin
      expect(response.body.meta.total).toBe(3);

      response.body.data.forEach((notification) => {
        expect(notification.title).toContain('Second Admin');
      });
    });

    it('should handle empty results', async () => {
      // Create a new admin with no notifications
      const emptyAdmin = await knex('admins')
        .insert({
          id: knex.raw('gen_random_uuid()'),
          first_name: 'Empty',
          last_name: 'Admin',
          phone: '+998903333333',
          login: 'emptyadmin',
          password: '$2b$10$K7L/VxwjnydKw.fK8tUqme7kk7IgJ9J9J9J9J9J9J9J9J9J9J9J9',
          branch_id: testBranch.id,
          status: 'Active',
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('*');

      const emptyToken = authService.generateJwtToken({
        id: emptyAdmin[0].id,
        login: emptyAdmin[0].login,
        first_name: emptyAdmin[0].first_name,
        last_name: emptyAdmin[0].last_name,
        phone: emptyAdmin[0].phone,
        branch_id: emptyAdmin[0].branch_id,
        status: emptyAdmin[0].status,
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${emptyToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(0);
      expect(response.body.meta.total).toBe(0);
    });

    it('should fail with invalid query parameters', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/notifications?limit=invalid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer()).get('/api/v1/notifications').expect(401);
    });

    it('should fail with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('PATCH /api/v1/notifications/:id/read (Mark Notification as Read)', () => {
    it('should mark notification as read successfully', async () => {
      // Get an unread notification
      const unreadNotification = testNotifications.find((n) => !n.is_read);

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/notifications/${unreadNotification.id}/read`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Notification marked as read',
      });

      // Verify notification was marked as read in database
      const updatedNotification = await knex('notifications')
        .where('id', unreadNotification.id)
        .first();
      expect(updatedNotification.is_read).toBe(true);
      expect(updatedNotification.read_at).toBeTruthy();
    });

    it('should handle already read notification', async () => {
      // Get a read notification
      const readNotification = testNotifications.find((n) => n.is_read);

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/notifications/${readNotification.id}/read`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Notification marked as read',
      });
    });

    it('should fail when marking non-existent notification', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/notifications/00000000-0000-4000-8000-000000000000/read')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should fail when marking notification that belongs to different admin', async () => {
      // Use notification that belongs to testAdmin with secondAdminToken
      const notification = testNotifications[0];

      await request(app.getHttpServer())
        .patch(`/api/v1/notifications/${notification.id}/read`)
        .set('Authorization', `Bearer ${secondAdminToken}`)
        .expect(404);
    });

    it('should fail with invalid UUID format', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/notifications/invalid-uuid/read')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should fail without authentication', async () => {
      const notification = testNotifications[0];

      await request(app.getHttpServer())
        .patch(`/api/v1/notifications/${notification.id}/read`)
        .expect(401);
    });

    it('should update read_at timestamp when marking as read', async () => {
      const unreadNotification = testNotifications.find((n) => !n.is_read);
      const beforeTime = new Date();

      await request(app.getHttpServer())
        .patch(`/api/v1/notifications/${unreadNotification.id}/read`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const afterTime = new Date();

      // Verify read_at timestamp was set
      const updatedNotification = await knex('notifications')
        .where('id', unreadNotification.id)
        .first();

      const readAt = new Date(updatedNotification.read_at);
      expect(readAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(readAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe('PATCH /api/v1/notifications/read-all (Mark All Notifications as Read)', () => {
    beforeEach(async () => {
      // Reset some notifications to unread for testing
      await knex('notifications').where('admin_id', testAdmin.id).update({
        is_read: false,
        read_at: null,
      });
    });

    it('should mark all notifications as read successfully', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toEqual({
        message: 'All notifications marked as read',
      });

      // Verify all notifications for admin are now read
      const notifications = await knex('notifications').where('admin_id', testAdmin.id);

      notifications.forEach((notification) => {
        expect(notification.is_read).toBe(true);
        expect(notification.read_at).toBeTruthy();
      });
    });

    it('should not affect notifications of other admins', async () => {
      // Mark all notifications as read for testAdmin
      await request(app.getHttpServer())
        .patch('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Verify secondTestAdmin notifications are unchanged
      const secondAdminNotifications = await knex('notifications').where(
        'admin_id',
        secondTestAdmin.id,
      );

      secondAdminNotifications.forEach((notification) => {
        expect(notification.is_read).toBe(false); // Should still be unread
      });
    });

    it('should handle case when all notifications are already read', async () => {
      // Mark all as read first
      await knex('notifications').where('admin_id', testAdmin.id).update({
        is_read: true,
        read_at: new Date(),
      });

      const response = await request(app.getHttpServer())
        .patch('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toEqual({
        message: 'All notifications marked as read',
      });
    });

    it('should handle case when admin has no notifications', async () => {
      // Create admin with no notifications
      const emptyAdmin = await knex('admins')
        .insert({
          id: knex.raw('gen_random_uuid()'),
          first_name: 'Empty',
          last_name: 'Admin',
          phone: '+998904444444',
          login: 'emptyadmin2',
          password: '$2b$10$K7L/VxwjnydKw.fK8tUqme7kk7IgJ9J9J9J9J9J9J9J9J9J9J9J9',
          branch_id: testBranch.id,
          status: 'Active',
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('*');

      const emptyToken = authService.generateJwtToken({
        id: emptyAdmin[0].id,
        login: emptyAdmin[0].login,
        first_name: emptyAdmin[0].first_name,
        last_name: emptyAdmin[0].last_name,
        phone: emptyAdmin[0].phone,
        branch_id: emptyAdmin[0].branch_id,
        status: emptyAdmin[0].status,
      });

      const response = await request(app.getHttpServer())
        .patch('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${emptyToken}`)
        .expect(200);

      expect(response.body).toEqual({
        message: 'All notifications marked as read',
      });
    });

    it('should update read_at timestamp for all notifications', async () => {
      const beforeTime = new Date();

      await request(app.getHttpServer())
        .patch('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const afterTime = new Date();

      // Verify all notifications have read_at timestamp
      const notifications = await knex('notifications').where('admin_id', testAdmin.id);

      notifications.forEach((notification) => {
        const readAt = new Date(notification.read_at);
        expect(readAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
        expect(readAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
      });
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer()).patch('/api/v1/notifications/read-all').expect(401);
    });
  });

  describe('Database Consistency Verification', () => {
    it('should maintain referential integrity for notifications and admins', async () => {
      const notifications = await knex('notifications').select('*');
      const admins = await knex('admins').select('*');

      for (const notification of notifications) {
        const admin = admins.find((a) => a.id === notification.admin_id);
        expect(admin).toBeTruthy();
      }
    });

    it('should maintain audit fields correctly', async () => {
      const notifications = await knex('notifications').select('*');

      for (const notification of notifications) {
        expect(notification.created_at).toBeTruthy();
        expect(notification.updated_at).toBeTruthy();
        expect(new Date(notification.created_at)).toBeInstanceOf(Date);
        expect(new Date(notification.updated_at)).toBeInstanceOf(Date);
      }
    });

    it('should properly handle read_at timestamps', async () => {
      const readNotifications = await knex('notifications').where('is_read', true);

      for (const notification of readNotifications) {
        expect(notification.read_at).toBeTruthy();
        expect(new Date(notification.read_at)).toBeInstanceOf(Date);
      }

      const unreadNotifications = await knex('notifications').where('is_read', false);

      for (const notification of unreadNotifications) {
        expect(notification.read_at).toBeNull();
      }
    });

    it('should maintain proper notification types', async () => {
      const notifications = await knex('notifications').select('*');
      const validTypes = ['system', 'repair_order', 'general', 'campaign'];

      for (const notification of notifications) {
        expect(validTypes).toContain(notification.type);
      }
    });
  });

  describe('Security and Authorization', () => {
    it('should prevent access to other admin notifications', async () => {
      // Try to access testAdmin notifications with secondAdminToken
      const response = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${secondAdminToken}`)
        .expect(200);

      // Should only return secondTestAdmin notifications
      expect(response.body.data.length).toBe(3);
      response.body.data.forEach((notification) => {
        expect(notification.title).toContain('Second Admin');
      });

      // None should be testAdmin notifications
      const testAdminTitles = testNotifications.map((n) => n.title);
      response.body.data.forEach((notification) => {
        expect(testAdminTitles).not.toContain(notification.title);
      });
    });

    it('should validate JWT token format', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .expect(401);
    });

    it('should prevent unauthorized access to protected endpoints', async () => {
      const endpoints = [
        { method: 'get', path: '/api/v1/notifications' },
        { method: 'patch', path: `/api/v1/notifications/${testNotifications[0].id}/read` },
        { method: 'patch', path: '/api/v1/notifications/read-all' },
      ];

      for (const endpoint of endpoints) {
        await request(app.getHttpServer())[endpoint.method](endpoint.path).expect(401);
      }
    });

    it('should isolate notification operations by admin', async () => {
      // Mark notification as read for testAdmin
      const testAdminNotification = testNotifications.find((n) => !n.is_read);
      await request(app.getHttpServer())
        .patch(`/api/v1/notifications/${testAdminNotification.id}/read`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // secondTestAdmin should not be able to access it
      await request(app.getHttpServer())
        .patch(`/api/v1/notifications/${testAdminNotification.id}/read`)
        .set('Authorization', `Bearer ${secondAdminToken}`)
        .expect(404);
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle large number of notifications efficiently', async () => {
      // Create many notifications for performance testing
      const notifications = [];
      for (let i = 1; i <= 100; i++) {
        notifications.push({
          id: knex.raw('gen_random_uuid()'),
          admin_id: testAdmin.id,
          title: `Performance Test ${i}`,
          message: `Performance testing notification ${i}`,
          type: 'general',
          is_read: false,
          created_at: new Date(Date.now() - i * 1000),
          updated_at: new Date(),
        });
      }

      await knex('notifications').insert(notifications);

      const startTime = Date.now();

      await request(app.getHttpServer())
        .get('/api/v1/notifications?limit=50')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(3000); // Should complete within 3 seconds
    });

    it('should handle concurrent read operations efficiently', async () => {
      const promises = [];
      const unreadNotifications = testNotifications.filter((n) => !n.is_read).slice(0, 5);

      for (const notification of unreadNotifications) {
        const promise = request(app.getHttpServer())
          .patch(`/api/v1/notifications/${notification.id}/read`)
          .set('Authorization', `Bearer ${adminToken}`);
        promises.push(promise);
      }

      const results = await Promise.allSettled(promises);
      const successful = results.filter((r) => r.status === 'fulfilled' && r.value.status === 200);

      expect(successful.length).toBe(unreadNotifications.length);
    });

    it('should handle mark-all-as-read operation efficiently', async () => {
      const startTime = Date.now();

      await request(app.getHttpServer())
        .patch('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle notification with null message gracefully', async () => {
      // Create notification with null message
      const notification = await knex('notifications')
        .insert({
          id: knex.raw('gen_random_uuid()'),
          admin_id: testAdmin.id,
          title: 'Null Message Test',
          message: null,
          type: 'system',
          is_read: false,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('*');

      const response = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const nullMessageNotification = response.body.data.find((n) => n.id === notification[0].id);
      expect(nullMessageNotification.message).toBeNull();
    });

    it('should handle very long notification content', async () => {
      const longMessage = 'A'.repeat(1000); // Very long message
      const notification = await knex('notifications')
        .insert({
          id: knex.raw('gen_random_uuid()'),
          admin_id: testAdmin.id,
          title: 'Long Message Test',
          message: longMessage,
          type: 'system',
          is_read: false,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('*');

      const response = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const longMessageNotification = response.body.data.find((n) => n.id === notification[0].id);
      expect(longMessageNotification.message).toBe(longMessage);
    });

    it('should handle database connection errors gracefully', async () => {
      // This test would require mocking database errors
      // Implementation depends on error handling in the service layer
    });
  });

  afterEach(async () => {
    // Generate coverage report after each test suite
    await CoverageHelpers.generateCoverageReport();
  });
});
