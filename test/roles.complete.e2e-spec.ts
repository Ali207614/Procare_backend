import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { RolesService } from '../src/roles/roles.service';
import { AuthService } from '../src/auth/auth.service';
import { TestModuleBuilder } from './utils/test-module-builder';
import { CoverageHelpers } from './utils/coverage-helpers';

describe('Roles Controller Complete E2E', () => {
  let app: INestApplication;
  let authService: AuthService;
  let rolesService: RolesService;
  let knex: any;
  let redis: any;
  let adminToken: string;
  let limitedAdminToken: string;
  let testAdmin: any;
  let limitedAdmin: any;
  let testBranch: any;
  let testRole: any;
  let secondTestRole: any;
  let testPermissions: any[];

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
    rolesService = module.get<RolesService>(RolesService);
    knex = module.get('KNEX_CONNECTION');
    redis = module.get('REDIS_CLIENT');

    // Clean database and cache
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

    // Create role permissions
    const rolePermissions = [
      'role.create',
      'role.view',
      'role.update',
      'role.delete',
      'role.manage',
    ];

    testPermissions = [];
    for (const permission of rolePermissions) {
      const perm = await knex('permissions')
        .insert({
          id: knex.raw('gen_random_uuid()'),
          name: permission,
          description: `Permission for ${permission}`,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('*');
      testPermissions.push(perm[0]);
    }

    // Create additional permissions for role assignment testing
    const additionalPermissions = [
      'user.create',
      'user.view',
      'user.update',
      'user.delete',
      'admin.create',
      'admin.view',
      'branch.create',
      'branch.view',
    ];

    for (const permission of additionalPermissions) {
      const perm = await knex('permissions')
        .insert({
          id: knex.raw('gen_random_uuid()'),
          name: permission,
          description: `Permission for ${permission}`,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('*');
      testPermissions.push(perm[0]);
    }

    // Create test role with all role permissions
    const fullRole = await knex('roles')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        name: 'Role Manager Role',
        description: 'Role for managing roles',
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    const role = fullRole[0];

    // Create limited role with only view permission
    const limitedRole = await knex('roles')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        name: 'Limited Role',
        description: 'Role with limited permissions',
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    const limitedRoleRecord = limitedRole[0];

    // Create test roles for testing CRUD operations
    testRole = await knex('roles')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        name: 'Test Role',
        description: 'Role for testing',
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    testRole = testRole[0];

    secondTestRole = await knex('roles')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        name: 'Second Test Role',
        description: 'Second role for testing',
        status: 'Inactive',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    secondTestRole = secondTestRole[0];

    // Assign all role permissions to full role
    const roleManagementPermissions = testPermissions.filter((p) => p.name.startsWith('role.'));
    for (const permission of roleManagementPermissions) {
      await knex('role_permissions').insert({
        id: knex.raw('gen_random_uuid()'),
        role_id: role.id,
        permission_id: permission.id,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    // Assign only view permission to limited role
    const viewPermission = testPermissions.find((p) => p.name === 'role.view');
    await knex('role_permissions').insert({
      id: knex.raw('gen_random_uuid()'),
      role_id: limitedRoleRecord.id,
      permission_id: viewPermission.id,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Assign some permissions to test roles for testing
    const userPermissions = testPermissions.filter((p) => p.name.startsWith('user.'));
    for (const permission of userPermissions) {
      await knex('role_permissions').insert({
        id: knex.raw('gen_random_uuid()'),
        role_id: testRole.id,
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

    limitedAdmin = await knex('admins')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        first_name: 'Limited',
        last_name: 'Admin',
        phone: '+998902222222',
        login: 'limitedadmin',
        password: '$2b$10$K7L/VxwjnydKw.fK8tUqme7kk7IgJ9J9J9J9J9J9J9J9J9J9J9J9',
        branch_id: testBranch.id,
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    limitedAdmin = limitedAdmin[0];

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
      admin_id: limitedAdmin.id,
      role_id: limitedRoleRecord.id,
      created_at: new Date(),
      updated_at: new Date(),
    });

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

    limitedAdminToken = authService.generateJwtToken({
      id: limitedAdmin.id,
      login: limitedAdmin.login,
      first_name: limitedAdmin.first_name,
      last_name: limitedAdmin.last_name,
      phone: limitedAdmin.phone,
      branch_id: limitedAdmin.branch_id,
      status: limitedAdmin.status,
    });
  }

  describe('POST /api/v1/roles (Create Role)', () => {
    it('should create role successfully with proper permissions', async () => {
      const newRoleData = {
        name: 'New Test Role',
        description: 'A new role for testing',
        permission_ids: [
          testPermissions.find((p) => p.name === 'user.view').id,
          testPermissions.find((p) => p.name === 'user.create').id,
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newRoleData)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        name: newRoleData.name,
        description: newRoleData.description,
        status: 'Active',
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });

      // Verify role was created in database
      const createdRole = await knex('roles').where('id', response.body.id).first();
      expect(createdRole).toBeTruthy();
      expect(createdRole.name).toBe(newRoleData.name);

      // Verify permissions were assigned
      const rolePermissions = await knex('role_permissions').where('role_id', response.body.id);
      expect(rolePermissions.length).toBe(2);
    });

    it('should create role without permissions', async () => {
      const roleData = {
        name: 'Role Without Permissions',
        description: 'Role with no initial permissions',
        permission_ids: [],
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(roleData)
        .expect(201);

      expect(response.body.name).toBe(roleData.name);

      // Verify no permissions were assigned
      const rolePermissions = await knex('role_permissions').where('role_id', response.body.id);
      expect(rolePermissions.length).toBe(0);
    });

    it('should fail with duplicate role name', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: testRole.name, // Same name as existing role
          description: 'Duplicate role',
          permission_ids: [],
        })
        .expect(400);
    });

    it('should fail with invalid permission IDs', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Permissions Role',
          description: 'Role with invalid permissions',
          permission_ids: ['00000000-0000-4000-8000-000000000000'],
        })
        .expect(400);
    });

    it('should fail with invalid data validation', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '', // Empty name
          description: 'Invalid role',
          permission_ids: 'not-array', // Invalid permission_ids format
        })
        .expect(400);
    });

    it('should fail without proper permissions', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${limitedAdminToken}`)
        .send({
          name: 'Unauthorized Role',
          description: 'Role created without permission',
          permission_ids: [],
        })
        .expect(403);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/roles')
        .send({
          name: 'No Auth Role',
          description: 'Role without authentication',
          permission_ids: [],
        })
        .expect(401);
    });
  });

  describe('GET /api/v1/roles (Get All Roles)', () => {
    beforeEach(async () => {
      // Create additional roles for pagination testing
      for (let i = 1; i <= 5; i++) {
        await knex('roles').insert({
          id: knex.raw('gen_random_uuid()'),
          name: `Role ${i}`,
          description: `Test role ${i}`,
          status: i % 2 === 0 ? 'Active' : 'Inactive',
          created_at: new Date(Date.now() - i * 3600000),
          updated_at: new Date(),
        });
      }
    });

    it('should return all roles with default pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/roles')
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

      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.meta.total).toBeGreaterThanOrEqual(response.body.data.length);

      // Verify role structure
      const role = response.body.data[0];
      expect(role).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        description: expect.any(String),
        status: expect.any(String),
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });
    });

    it('should filter roles by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/roles?status=Active')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      response.body.data.forEach((role) => {
        expect(role.status).toBe('Active');
      });
    });

    it('should search roles by name', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/roles?search=Test Role')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      const foundRole = response.body.data.find((role) => role.name === 'Test Role');
      expect(foundRole).toBeTruthy();
    });

    it('should search roles by description', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/roles?search=testing')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      response.body.data.forEach((role) => {
        const matchesName = role.name.toLowerCase().includes('test');
        const matchesDescription = role.description.toLowerCase().includes('test');
        expect(matchesName || matchesDescription).toBe(true);
      });
    });

    it('should paginate results correctly', async () => {
      const limit = 3;
      const offset = 2;

      const response = await request(app.getHttpServer())
        .get(`/api/v1/roles?limit=${limit}&offset=${offset}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.meta.limit).toBe(limit);
      expect(response.body.meta.offset).toBe(offset);
      expect(response.body.data.length).toBeLessThanOrEqual(limit);
    });

    it('should sort roles by creation date', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/roles?sort_by=created_at&sort_order=desc')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const dates = response.body.data.map((role) => new Date(role.created_at));
      const sortedDates = [...dates].sort((a, b) => b.getTime() - a.getTime());
      expect(dates).toEqual(sortedDates);
    });

    it('should handle combined filters and pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/roles?status=Active&limit=2&sort_by=name&sort_order=asc')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(2);
      response.body.data.forEach((role) => {
        expect(role.status).toBe('Active');
      });
    });

    it('should return empty results for non-matching search', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/roles?search=NonExistentRole')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(0);
      expect(response.body.meta.total).toBe(0);
    });

    it('should fail with invalid query parameters', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/roles?limit=invalid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should allow limited admin with role.view permission', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/roles')
        .set('Authorization', `Bearer ${limitedAdminToken}`)
        .expect(200);

      expect(response.body.data).toEqual(expect.any(Array));
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer()).get('/api/v1/roles').expect(401);
    });
  });

  describe('GET /api/v1/roles/:id (Get Role by ID)', () => {
    it('should return role with permissions successfully', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/roles/${testRole.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: testRole.id,
        name: testRole.name,
        description: testRole.description,
        status: testRole.status,
        created_at: expect.any(String),
        updated_at: expect.any(String),
        permissions: expect.any(Array),
      });

      // Should include assigned permissions
      expect(response.body.permissions.length).toBeGreaterThan(0);

      // Verify permission structure
      const permission = response.body.permissions[0];
      expect(permission).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        description: expect.any(String),
      });
    });

    it('should return role without permissions if none assigned', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/roles/${secondTestRole.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.permissions).toHaveLength(0);
    });

    it('should fail with non-existent role ID', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/roles/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should fail with invalid UUID format', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/roles/invalid-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should allow limited admin with role.view permission', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/roles/${testRole.id}`)
        .set('Authorization', `Bearer ${limitedAdminToken}`)
        .expect(200);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer()).get(`/api/v1/roles/${testRole.id}`).expect(401);
    });
  });

  describe('PATCH /api/v1/roles/:id (Update Role)', () => {
    it('should update role successfully', async () => {
      const updateData = {
        name: 'Updated Role Name',
        description: 'Updated role description',
        status: 'Inactive',
        permission_ids: [testPermissions.find((p) => p.name === 'branch.view').id],
      };

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/roles/${testRole.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Role updated successfully',
      });

      // Verify role was updated in database
      const updatedRole = await knex('roles').where('id', testRole.id).first();
      expect(updatedRole.name).toBe(updateData.name);
      expect(updatedRole.description).toBe(updateData.description);
      expect(updatedRole.status).toBe(updateData.status);

      // Verify permissions were updated
      const rolePermissions = await knex('role_permissions').where('role_id', testRole.id);
      expect(rolePermissions.length).toBe(1);
    });

    it('should update partial role data', async () => {
      const updateData = {
        name: 'Partially Updated Role',
      };

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/roles/${secondTestRole.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Role updated successfully',
      });

      // Verify only specified field was updated
      const updatedRole = await knex('roles').where('id', secondTestRole.id).first();
      expect(updatedRole.name).toBe(updateData.name);
      expect(updatedRole.status).toBe(secondTestRole.status); // Should remain unchanged
    });

    it('should clear all permissions when empty array provided', async () => {
      const updateData = {
        permission_ids: [],
      };

      await request(app.getHttpServer())
        .patch(`/api/v1/roles/${testRole.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      // Verify permissions were cleared
      const rolePermissions = await knex('role_permissions').where('role_id', testRole.id);
      expect(rolePermissions.length).toBe(0);
    });

    it('should fail when updating non-existent role', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/roles/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Non-existent Role',
        })
        .expect(404);
    });

    it('should fail with duplicate name', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/roles/${secondTestRole.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: testRole.name, // Trying to use existing name
        })
        .expect(400);
    });

    it('should fail with invalid permission IDs', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/roles/${testRole.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          permission_ids: ['00000000-0000-4000-8000-000000000000'],
        })
        .expect(400);
    });

    it('should fail without proper permissions', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/roles/${testRole.id}`)
        .set('Authorization', `Bearer ${limitedAdminToken}`)
        .send({
          name: 'Unauthorized Update',
        })
        .expect(403);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/roles/${testRole.id}`)
        .send({
          name: 'No Auth Update',
        })
        .expect(401);
    });
  });

  describe('DELETE /api/v1/roles/:id (Delete Role)', () => {
    beforeEach(async () => {
      // Create a role specifically for deletion testing
      const deleteRole = await knex('roles')
        .insert({
          id: knex.raw('gen_random_uuid()'),
          name: 'Delete Test Role',
          description: 'Role for deletion testing',
          status: 'Active',
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('*');

      // Store the ID for use in tests
      this.deleteRoleId = deleteRole[0].id;
    });

    it('should delete role successfully', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/v1/roles/${this.deleteRoleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Role deleted successfully',
      });

      // Verify role was soft deleted in database
      const deletedRole = await knex('roles').where('id', this.deleteRoleId).first();
      expect(deletedRole.deleted_at).toBeTruthy();
    });

    it('should fail when deleting non-existent role', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/roles/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should fail when trying to delete already deleted role', async () => {
      // Delete role first
      await request(app.getHttpServer())
        .delete(`/api/v1/roles/${this.deleteRoleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Try to delete again
      await request(app.getHttpServer())
        .delete(`/api/v1/roles/${this.deleteRoleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should fail with invalid UUID format', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/roles/invalid-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should fail without proper permissions', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/roles/${this.deleteRoleId}`)
        .set('Authorization', `Bearer ${limitedAdminToken}`)
        .expect(403);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer()).delete(`/api/v1/roles/${this.deleteRoleId}`).expect(401);
    });

    it('should cascade delete role permissions when role is deleted', async () => {
      // Assign permissions to role before deletion
      const permission = testPermissions[0];
      await knex('role_permissions').insert({
        id: knex.raw('gen_random_uuid()'),
        role_id: this.deleteRoleId,
        permission_id: permission.id,
        created_at: new Date(),
        updated_at: new Date(),
      });

      // Delete role
      await request(app.getHttpServer())
        .delete(`/api/v1/roles/${this.deleteRoleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Verify role permissions were deleted
      const rolePermissions = await knex('role_permissions').where('role_id', this.deleteRoleId);
      expect(rolePermissions.length).toBe(0);
    });
  });

  describe('Database Consistency Verification', () => {
    it('should maintain referential integrity for role permissions', async () => {
      const roles = await knex('roles').select('*');
      const permissions = await knex('permissions').select('*');
      const rolePermissions = await knex('role_permissions').select('*');

      for (const rolePermission of rolePermissions) {
        const role = roles.find((r) => r.id === rolePermission.role_id);
        const permission = permissions.find((p) => p.id === rolePermission.permission_id);
        expect(role).toBeTruthy();
        expect(permission).toBeTruthy();
      }
    });

    it('should maintain audit fields correctly', async () => {
      const roles = await knex('roles').select('*');

      for (const role of roles) {
        expect(role.created_at).toBeTruthy();
        expect(role.updated_at).toBeTruthy();
        expect(new Date(role.created_at)).toBeInstanceOf(Date);
        expect(new Date(role.updated_at)).toBeInstanceOf(Date);
      }
    });

    it('should properly handle soft deletes', async () => {
      // Soft delete a role
      await rolesService.delete(secondTestRole.id);

      // Verify role is soft deleted
      const deletedRole = await knex('roles').where('id', secondTestRole.id).first();
      expect(deletedRole.deleted_at).toBeTruthy();

      // Verify role doesn't appear in active queries
      const activeRoles = await knex('roles').whereNull('deleted_at');
      expect(activeRoles.find((r) => r.id === secondTestRole.id)).toBeFalsy();
    });

    it('should enforce unique constraints on role names', async () => {
      try {
        await knex('roles').insert({
          id: knex.raw('gen_random_uuid()'),
          name: testRole.name, // Duplicate name
          description: 'Duplicate role',
          status: 'Active',
          created_at: new Date(),
          updated_at: new Date(),
        });
        fail('Should have thrown unique constraint error');
      } catch (error) {
        expect(error.code).toBe('23505'); // PostgreSQL unique constraint violation
      }
    });
  });

  describe('Security and Authorization', () => {
    it('should prevent unauthorized access to protected endpoints', async () => {
      const protectedEndpoints = [
        { method: 'post', path: '/api/v1/roles' },
        { method: 'patch', path: `/api/v1/roles/${testRole.id}` },
        { method: 'delete', path: `/api/v1/roles/${testRole.id}` },
      ];

      for (const endpoint of protectedEndpoints) {
        await request(app.getHttpServer())[endpoint.method](endpoint.path).expect(401);
      }
    });

    it('should validate admin permissions for each operation', async () => {
      const protectedEndpoints = [
        { method: 'post', path: '/api/v1/roles', data: { name: 'Test', description: 'Test' } },
        { method: 'patch', path: `/api/v1/roles/${testRole.id}`, data: { name: 'Updated' } },
        { method: 'delete', path: `/api/v1/roles/${testRole.id}` },
      ];

      for (const endpoint of protectedEndpoints) {
        const req = request(app.getHttpServer())
          [endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${limitedAdminToken}`);

        if (endpoint.data) {
          req.send(endpoint.data);
        }

        await req.expect(403);
      }
    });

    it('should validate JWT token format', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/roles')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .expect(401);
    });

    it('should prevent role name enumeration through error messages', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/roles/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      // Error message should not reveal internal information
      expect(response.body.message).not.toContain('database');
      expect(response.body.message).not.toContain('sql');
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle concurrent role creation requests', async () => {
      const promises = [];
      const roleCount = 5;

      for (let i = 0; i < roleCount; i++) {
        const promise = request(app.getHttpServer())
          .post('/api/v1/roles')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: `Concurrent Role ${i}`,
            description: `Concurrent role ${i}`,
            permission_ids: [],
          });
        promises.push(promise);
      }

      const results = await Promise.allSettled(promises);
      const successful = results.filter((r) => r.status === 'fulfilled' && r.value.status === 201);

      expect(successful.length).toBe(roleCount);
    });

    it('should handle large paginated requests efficiently', async () => {
      const startTime = Date.now();

      await request(app.getHttpServer())
        .get('/api/v1/roles?limit=100')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle roles with many permissions efficiently', async () => {
      // Create role with many permissions
      const manyPermissionsRole = await knex('roles')
        .insert({
          id: knex.raw('gen_random_uuid()'),
          name: 'Many Permissions Role',
          description: 'Role with many permissions',
          status: 'Active',
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('*');

      // Assign all available permissions
      for (const permission of testPermissions) {
        await knex('role_permissions').insert({
          id: knex.raw('gen_random_uuid()'),
          role_id: manyPermissionsRole[0].id,
          permission_id: permission.id,
          created_at: new Date(),
          updated_at: new Date(),
        });
      }

      const startTime = Date.now();

      await request(app.getHttpServer())
        .get(`/api/v1/roles/${manyPermissionsRole[0].id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(3000); // Should complete within 3 seconds
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle very long role names', async () => {
      const longName = 'A'.repeat(255); // Very long name

      await request(app.getHttpServer())
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: longName,
          description: 'Role with long name',
          permission_ids: [],
        })
        .expect(400); // Should fail validation
    });

    it('should handle special characters in role names', async () => {
      const specialChars = 'Test Role @#$%^&*()';

      const response = await request(app.getHttpServer())
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: specialChars,
          description: 'Role with special characters',
          permission_ids: [],
        })
        .expect(201);

      expect(response.body.name).toBe(specialChars);
    });

    it('should handle null description gracefully', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Null Description Role',
          description: null,
          permission_ids: [],
        })
        .expect(201);

      expect(response.body.description).toBeNull();
    });
  });

  afterEach(async () => {
    // Generate coverage report after each test suite
    await CoverageHelpers.generateCoverageReport();
  });
});
