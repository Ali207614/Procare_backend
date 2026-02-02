import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AdminFactory } from './factories/admin.factory';
import { PermissionFactory } from './factories/permission.factory';
import { TestHelpers } from './utils/test-helpers';

describe('Permissions (e2e)', () => {
  let app: INestApplication;
  let knex: any;
  let adminData: any;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    knex = moduleFixture.get('KnexConnection');

    // Create test admin with appropriate permissions
    adminData = await AdminFactory.create(knex);
    authToken = await TestHelpers.authenticateAdmin(app, adminData);
  });

  beforeEach(async () => {
    await TestHelpers.cleanPermissionsTable(knex);
  });

  afterAll(async () => {
    await TestHelpers.cleanDatabase(knex);
    await app.close();
  });

  describe('/permissions (GET)', () => {
    it('should return permissions with pagination', async () => {
      // Arrange
      const permissions = await PermissionFactory.createMany(knex, 5);

      // Act & Assert
      const response = await request(app.getHttpServer())
        .get('/permissions')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 3, offset: 0 })
        .expect(200);

      expect(response.body.data).toHaveLength(3);
      expect(response.body.meta.total).toBe(5);
      expect(response.body.meta.limit).toBe(3);
      expect(response.body.meta.offset).toBe(0);
    });

    it('should filter permissions by resource', async () => {
      // Arrange
      await PermissionFactory.create(knex, { resource: 'repair_orders' });
      await PermissionFactory.create(knex, { resource: 'users' });
      await PermissionFactory.create(knex, { resource: 'repair_orders' });

      // Act & Assert
      const response = await request(app.getHttpServer())
        .get('/permissions')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ resource: 'repair_orders' })
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.every((p) => p.resource === 'repair_orders')).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer()).get('/permissions').expect(401);
    });
  });

  describe('/permissions (POST)', () => {
    it('should create permission successfully', async () => {
      // Arrange
      const permissionDto = {
        resource: 'repair_orders',
        action: 'create',
        description: 'Create repair orders',
      };

      // Act & Assert
      const response = await request(app.getHttpServer())
        .post('/permissions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(permissionDto)
        .expect(201);

      expect(response.body.message).toBe('Permission created successfully');

      const permission = await knex('permissions')
        .where({ resource: 'repair_orders', action: 'create' })
        .first();

      expect(permission).toBeDefined();
      expect(permission.description).toBe('Create repair orders');
    });

    it('should return 400 for invalid data', async () => {
      // Arrange
      const invalidDto = {
        resource: '', // Empty resource
        action: 'create',
      };

      // Act & Assert
      await request(app.getHttpServer())
        .post('/permissions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidDto)
        .expect(400);
    });

    it('should return 409 for duplicate permission', async () => {
      // Arrange
      await PermissionFactory.create(knex, {
        resource: 'users',
        action: 'delete',
      });

      const duplicateDto = {
        resource: 'users',
        action: 'delete',
        description: 'Delete users',
      };

      // Act & Assert
      const response = await request(app.getHttpServer())
        .post('/permissions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(duplicateDto)
        .expect(409);

      expect(response.body.message).toContain('already exists');
    });
  });

  describe('/permissions/:id (GET)', () => {
    it('should return permission by id', async () => {
      // Arrange
      const permission = await PermissionFactory.create(knex);

      // Act & Assert
      const response = await request(app.getHttpServer())
        .get(`/permissions/${permission.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.id).toBe(permission.id);
      expect(response.body.data.resource).toBe(permission.resource);
      expect(response.body.data.action).toBe(permission.action);
    });

    it('should return 404 for non-existent permission', async () => {
      // Act & Assert
      const response = await request(app.getHttpServer())
        .get('/permissions/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.message).toContain('not found');
    });
  });

  describe('/permissions/:id (PATCH)', () => {
    it('should update permission successfully', async () => {
      // Arrange
      const permission = await PermissionFactory.create(knex, {
        description: 'Old description',
      });

      const updateDto = {
        description: 'Updated description',
        resource: 'updated_resource',
      };

      // Act & Assert
      const response = await request(app.getHttpServer())
        .patch(`/permissions/${permission.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.message).toBe('Permission updated successfully');

      const updatedPermission = await knex('permissions').where({ id: permission.id }).first();

      expect(updatedPermission.description).toBe('Updated description');
      expect(updatedPermission.resource).toBe('updated_resource');
    });

    it('should return 404 for non-existent permission', async () => {
      // Act & Assert
      await request(app.getHttpServer())
        .patch('/permissions/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ description: 'New description' })
        .expect(404);
    });
  });

  describe('/permissions/:id (DELETE)', () => {
    it('should soft delete permission', async () => {
      // Arrange
      const permission = await PermissionFactory.create(knex);

      // Act & Assert
      const response = await request(app.getHttpServer())
        .delete(`/permissions/${permission.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toBe('Permission deleted successfully');

      const deletedPermission = await knex('permissions').where({ id: permission.id }).first();

      expect(deletedPermission.deleted_at).toBeDefined();
    });

    it('should return 404 for non-existent permission', async () => {
      // Act & Assert
      await request(app.getHttpServer())
        .delete('/permissions/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('/permissions/resource/:resource (GET)', () => {
    it('should return all permissions for a resource', async () => {
      // Arrange
      await PermissionFactory.create(knex, { resource: 'repair_orders', action: 'create' });
      await PermissionFactory.create(knex, { resource: 'repair_orders', action: 'read' });
      await PermissionFactory.create(knex, { resource: 'users', action: 'create' });

      // Act & Assert
      const response = await request(app.getHttpServer())
        .get('/permissions/resource/repair_orders')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.every((p) => p.resource === 'repair_orders')).toBe(true);
    });
  });

  describe('/permissions/check (POST)', () => {
    it('should check user permission correctly', async () => {
      // Arrange
      const permission = await PermissionFactory.create(knex, {
        resource: 'repair_orders',
        action: 'create',
      });

      // Add permission to admin's role
      await knex('role_permissions').insert({
        role_id: adminData.role_id,
        permission_id: permission.id,
      });

      const checkDto = {
        admin_id: adminData.id,
        permission: 'repair_orders.create',
      };

      // Act & Assert
      const response = await request(app.getHttpServer())
        .post('/permissions/check')
        .set('Authorization', `Bearer ${authToken}`)
        .send(checkDto)
        .expect(200);

      expect(response.body.data.has_permission).toBe(true);
    });

    it('should return false for invalid permission', async () => {
      // Arrange
      const checkDto = {
        admin_id: adminData.id,
        permission: 'repair_orders.delete',
      };

      // Act & Assert
      const response = await request(app.getHttpServer())
        .post('/permissions/check')
        .set('Authorization', `Bearer ${authToken}`)
        .send(checkDto)
        .expect(200);

      expect(response.body.data.has_permission).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle server errors gracefully', async () => {
      // Simulate server error by using invalid database query
      const originalKnex = knex.raw;
      knex.raw = () => Promise.reject(new Error('Database connection failed'));

      const response = await request(app.getHttpServer())
        .get('/permissions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      expect(response.body.message).toContain('Internal server error');

      // Restore original function
      knex.raw = originalKnex;
    });

    it('should validate request data properly', async () => {
      // Test with various invalid inputs
      const invalidInputs = [
        { resource: null, action: 'create' },
        { resource: 'test', action: '' },
        { resource: 'test', action: 'invalid-action-type' },
        { description: 'a'.repeat(501) }, // Too long description
      ];

      for (const input of invalidInputs) {
        await request(app.getHttpServer())
          .post('/permissions')
          .set('Authorization', `Bearer ${authToken}`)
          .send(input)
          .expect(400);
      }
    });
  });

  describe('Performance', () => {
    it('should handle large datasets efficiently', async () => {
      // Arrange
      const permissions = await PermissionFactory.createMany(knex, 100);

      // Act
      const start = Date.now();
      const response = await request(app.getHttpServer())
        .get('/permissions')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 50, offset: 0 })
        .expect(200);
      const duration = Date.now() - start;

      // Assert
      expect(response.body.data).toHaveLength(50);
      expect(response.body.meta.total).toBe(100);
      expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
    });
  });
});
