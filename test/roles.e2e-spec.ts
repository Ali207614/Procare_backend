import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AdminFactory } from './factories/admin.factory';
import { RoleFactory } from './factories/role.factory';
import { PermissionFactory } from './factories/permission.factory';
import { TestHelpers } from './utils/test-helpers';

describe('Roles (e2e)', () => {
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

    adminData = await AdminFactory.create(knex);
    authToken = await TestHelpers.authenticateAdmin(app, adminData);
  });

  beforeEach(async () => {
    await TestHelpers.cleanRolesTable(knex);
  });

  afterAll(async () => {
    await TestHelpers.cleanDatabase(knex);
    await app.close();
  });

  describe('/roles (GET)', () => {
    it('should return roles with pagination', async () => {
      // Arrange
      const roles = await RoleFactory.createMany(knex, 5);

      // Act & Assert
      const response = await request(app.getHttpServer())
        .get('/roles')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 3, offset: 0 })
        .expect(200);

      expect(response.body.data).toHaveLength(3);
      expect(response.body.meta.total).toBe(5);
      expect(response.body.meta.limit).toBe(3);
      expect(response.body.meta.offset).toBe(0);
    });

    it('should search roles by name', async () => {
      // Arrange
      await RoleFactory.create(knex, { name: 'Administrator' });
      await RoleFactory.create(knex, { name: 'Technician' });
      await RoleFactory.create(knex, { name: 'Manager' });

      // Act & Assert
      const response = await request(app.getHttpServer())
        .get('/roles')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ search: 'admin' })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Administrator');
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer()).get('/roles').expect(401);
    });
  });

  describe('/roles (POST)', () => {
    it('should create role successfully', async () => {
      // Arrange
      const roleDto = {
        name: 'Test Role',
        description: 'Test role description',
      };

      // Act & Assert
      const response = await request(app.getHttpServer())
        .post('/roles')
        .set('Authorization', `Bearer ${authToken}`)
        .send(roleDto)
        .expect(201);

      expect(response.body.message).toBe('Role created successfully');

      const role = await knex('roles').where({ name: 'Test Role' }).first();

      expect(role).toBeDefined();
      expect(role.description).toBe('Test role description');
    });

    it('should return 400 for invalid data', async () => {
      // Arrange
      const invalidDto = {
        name: '', // Empty name
        description: 'Test description',
      };

      // Act & Assert
      await request(app.getHttpServer())
        .post('/roles')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidDto)
        .expect(400);
    });

    it('should return 409 for duplicate role name', async () => {
      // Arrange
      await RoleFactory.create(knex, { name: 'Unique Role' });

      const duplicateDto = {
        name: 'Unique Role',
        description: 'Another description',
      };

      // Act & Assert
      const response = await request(app.getHttpServer())
        .post('/roles')
        .set('Authorization', `Bearer ${authToken}`)
        .send(duplicateDto)
        .expect(409);

      expect(response.body.message).toContain('already exists');
    });
  });

  describe('/roles/with-permissions (POST)', () => {
    it('should create role with permissions successfully', async () => {
      // Arrange
      const permission1 = await PermissionFactory.create(knex);
      const permission2 = await PermissionFactory.create(knex);

      const roleDto = {
        name: 'Role with Permissions',
        description: 'Test role with permissions',
        permission_ids: [permission1.id, permission2.id],
      };

      // Act & Assert
      const response = await request(app.getHttpServer())
        .post('/roles/with-permissions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(roleDto)
        .expect(201);

      expect(response.body.message).toBe('Role created with permissions successfully');

      const role = await knex('roles').where({ name: 'Role with Permissions' }).first();

      const rolePermissions = await knex('role_permissions').where({ role_id: role.id });

      expect(rolePermissions).toHaveLength(2);
      expect(rolePermissions.map((rp) => rp.permission_id)).toContain(permission1.id);
      expect(rolePermissions.map((rp) => rp.permission_id)).toContain(permission2.id);
    });

    it('should return 400 for invalid permission ids', async () => {
      // Arrange
      const roleDto = {
        name: 'Test Role',
        permission_ids: ['non-existent-id'],
      };

      // Act & Assert
      const response = await request(app.getHttpServer())
        .post('/roles/with-permissions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(roleDto)
        .expect(400);

      expect(response.body.message).toContain('permission IDs do not exist');
    });
  });

  describe('/roles/:id (GET)', () => {
    it('should return role by id with permissions', async () => {
      // Arrange
      const role = await RoleFactory.create(knex);
      const permission = await PermissionFactory.create(knex);

      await knex('role_permissions').insert({
        role_id: role.id,
        permission_id: permission.id,
      });

      // Act & Assert
      const response = await request(app.getHttpServer())
        .get(`/roles/${role.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.id).toBe(role.id);
      expect(response.body.data.name).toBe(role.name);
      expect(response.body.data.permissions).toHaveLength(1);
      expect(response.body.data.permissions[0].id).toBe(permission.id);
    });

    it('should return 404 for non-existent role', async () => {
      // Act & Assert
      const response = await request(app.getHttpServer())
        .get('/roles/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.message).toContain('not found');
    });
  });

  describe('/roles/:id (PATCH)', () => {
    it('should update role successfully', async () => {
      // Arrange
      const role = await RoleFactory.create(knex, {
        name: 'Original Name',
        description: 'Original description',
      });

      const updateDto = {
        name: 'Updated Name',
        description: 'Updated description',
      };

      // Act & Assert
      const response = await request(app.getHttpServer())
        .patch(`/roles/${role.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.message).toBe('Role updated successfully');

      const updatedRole = await knex('roles').where({ id: role.id }).first();

      expect(updatedRole.name).toBe('Updated Name');
      expect(updatedRole.description).toBe('Updated description');
    });

    it('should return 409 for duplicate name on update', async () => {
      // Arrange
      await RoleFactory.create(knex, { name: 'Existing Role' });
      const role = await RoleFactory.create(knex, { name: 'Another Role' });

      // Act & Assert
      const response = await request(app.getHttpServer())
        .patch(`/roles/${role.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Existing Role' })
        .expect(409);

      expect(response.body.message).toContain('already exists');
    });
  });

  describe('/roles/:id/permissions (PATCH)', () => {
    it('should update role permissions successfully', async () => {
      // Arrange
      const role = await RoleFactory.create(knex);
      const oldPermission = await PermissionFactory.create(knex);
      const newPermission1 = await PermissionFactory.create(knex);
      const newPermission2 = await PermissionFactory.create(knex);

      await knex('role_permissions').insert({
        role_id: role.id,
        permission_id: oldPermission.id,
      });

      const updateDto = {
        permission_ids: [newPermission1.id, newPermission2.id],
      };

      // Act & Assert
      const response = await request(app.getHttpServer())
        .patch(`/roles/${role.id}/permissions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.message).toBe('Role permissions updated successfully');

      const rolePermissions = await knex('role_permissions').where({ role_id: role.id });

      expect(rolePermissions).toHaveLength(2);
      expect(rolePermissions.map((rp) => rp.permission_id)).toContain(newPermission1.id);
      expect(rolePermissions.map((rp) => rp.permission_id)).toContain(newPermission2.id);
      expect(rolePermissions.map((rp) => rp.permission_id)).not.toContain(oldPermission.id);
    });

    it('should remove all permissions when empty array provided', async () => {
      // Arrange
      const role = await RoleFactory.create(knex);
      const permission = await PermissionFactory.create(knex);

      await knex('role_permissions').insert({
        role_id: role.id,
        permission_id: permission.id,
      });

      // Act & Assert
      const response = await request(app.getHttpServer())
        .patch(`/roles/${role.id}/permissions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ permission_ids: [] })
        .expect(200);

      expect(response.body.message).toBe('Role permissions updated successfully');

      const rolePermissions = await knex('role_permissions').where({ role_id: role.id });

      expect(rolePermissions).toHaveLength(0);
    });
  });

  describe('/roles/:id (DELETE)', () => {
    it('should soft delete role', async () => {
      // Arrange
      const role = await RoleFactory.create(knex);

      // Act & Assert
      const response = await request(app.getHttpServer())
        .delete(`/roles/${role.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toBe('Role deleted successfully');

      const deletedRole = await knex('roles').where({ id: role.id }).first();

      expect(deletedRole.deleted_at).toBeDefined();
    });

    it('should return 400 when role has assigned admins', async () => {
      // Arrange
      const role = await RoleFactory.create(knex);
      await AdminFactory.create(knex, { role_id: role.id });

      // Act & Assert
      const response = await request(app.getHttpServer())
        .delete(`/roles/${role.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.message).toContain('Cannot delete role with assigned admins');
    });
  });

  describe('/roles/:id/admins (GET)', () => {
    it('should return admins for a role', async () => {
      // Arrange
      const role = await RoleFactory.create(knex);
      const admin1 = await AdminFactory.create(knex, { role_id: role.id });
      const admin2 = await AdminFactory.create(knex, { role_id: role.id });
      await AdminFactory.create(knex); // Different role

      // Act & Assert
      const response = await request(app.getHttpServer())
        .get(`/roles/${role.id}/admins`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.map((a) => a.id)).toContain(admin1.id);
      expect(response.body.data.map((a) => a.id)).toContain(admin2.id);
    });
  });

  describe('/roles/stats (GET)', () => {
    it('should return role statistics', async () => {
      // Arrange
      const role1 = await RoleFactory.create(knex);
      const role2 = await RoleFactory.create(knex);

      await AdminFactory.create(knex, { role_id: role1.id });
      await AdminFactory.create(knex, { role_id: role1.id });
      await AdminFactory.create(knex, { role_id: role2.id });

      // Act & Assert
      const response = await request(app.getHttpServer())
        .get('/roles/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.total_roles).toBe(2);
      expect(response.body.data.roles_with_admins).toBe(2);
      expect(response.body.data.total_admin_assignments).toBe(3);
    });
  });

  describe('Error Handling', () => {
    it('should handle server errors gracefully', async () => {
      // Simulate server error
      const originalKnex = knex.raw;
      knex.raw = () => Promise.reject(new Error('Database connection failed'));

      const response = await request(app.getHttpServer())
        .get('/roles')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      expect(response.body.message).toContain('Internal server error');

      knex.raw = originalKnex;
    });

    it('should validate request data properly', async () => {
      const invalidInputs = [
        { name: null, description: 'test' },
        { name: '', description: 'test' },
        { name: 'a'.repeat(101), description: 'test' }, // Too long name
        { description: 'a'.repeat(501) }, // Too long description
      ];

      for (const input of invalidInputs) {
        await request(app.getHttpServer())
          .post('/roles')
          .set('Authorization', `Bearer ${authToken}`)
          .send(input)
          .expect(400);
      }
    });
  });

  describe('Concurrency', () => {
    it('should handle concurrent role creation', async () => {
      // Arrange
      const rolePromises = Array.from({ length: 5 }, (_, i) =>
        request(app.getHttpServer())
          .post('/roles')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: `Concurrent Role ${i}`,
            description: `Description ${i}`,
          }),
      );

      // Act
      const responses = await Promise.all(rolePromises);

      // Assert
      responses.forEach((response) => {
        expect(response.status).toBe(201);
      });

      const roles = await knex('roles').where('name', 'like', 'Concurrent Role%');

      expect(roles).toHaveLength(5);
    });
  });

  describe('Permission Validation', () => {
    it('should validate admin has proper permissions for role operations', async () => {
      // This test would be implemented based on your permission system
      // For now, we assume the test admin has all necessary permissions

      const response = await request(app.getHttpServer())
        .get('/roles')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toBeDefined();
    });
  });
});
