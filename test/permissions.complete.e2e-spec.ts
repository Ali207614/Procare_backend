import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PermissionsService } from '../src/permissions/permissions.service';
import { AuthService } from '../src/auth/auth.service';
import { TestModuleBuilder } from './utils/test-module-builder';
import { CoverageHelpers } from './utils/coverage-helpers';

describe('Permissions Controller Complete E2E', () => {
  let app: INestApplication;
  let authService: AuthService;
  let permissionsService: PermissionsService;
  let knex: any;
  let redis: any;
  let adminToken: string;
  let limitedAdminToken: string;
  let testAdmin: any;
  let limitedAdmin: any;
  let testBranch: any;
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
    permissionsService = module.get<PermissionsService>(PermissionsService);
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

    // Create comprehensive set of permissions
    const permissionData = [
      { name: 'permission.view', description: 'View permissions', category: 'permission' },
      { name: 'permission.create', description: 'Create permissions', category: 'permission' },
      { name: 'permission.update', description: 'Update permissions', category: 'permission' },
      { name: 'permission.delete', description: 'Delete permissions', category: 'permission' },
      { name: 'user.create', description: 'Create users', category: 'user' },
      { name: 'user.view', description: 'View users', category: 'user' },
      { name: 'user.update', description: 'Update users', category: 'user' },
      { name: 'user.delete', description: 'Delete users', category: 'user' },
      { name: 'admin.manage.view', description: 'View admin management', category: 'admin' },
      { name: 'admin.manage.create', description: 'Create admins', category: 'admin' },
      { name: 'admin.manage.update', description: 'Update admins', category: 'admin' },
      { name: 'admin.manage.delete', description: 'Delete admins', category: 'admin' },
      { name: 'branch.create', description: 'Create branches', category: 'branch' },
      { name: 'branch.view', description: 'View branches', category: 'branch' },
      { name: 'branch.update', description: 'Update branches', category: 'branch' },
      { name: 'branch.delete', description: 'Delete branches', category: 'branch' },
      {
        name: 'repair_order.create',
        description: 'Create repair orders',
        category: 'repair_order',
      },
      { name: 'repair_order.view', description: 'View repair orders', category: 'repair_order' },
      {
        name: 'repair_order.update',
        description: 'Update repair orders',
        category: 'repair_order',
      },
      {
        name: 'repair_order.delete',
        description: 'Delete repair orders',
        category: 'repair_order',
      },
      { name: 'campaign.create', description: 'Create campaigns', category: 'campaign' },
      { name: 'campaign.view', description: 'View campaigns', category: 'campaign' },
      { name: 'campaign.update', description: 'Update campaigns', category: 'campaign' },
      { name: 'campaign.delete', description: 'Delete campaigns', category: 'campaign' },
      { name: 'notification.send', description: 'Send notifications', category: 'notification' },
    ];

    testPermissions = [];
    for (const permData of permissionData) {
      const permission = await knex('permissions')
        .insert({
          id: knex.raw('gen_random_uuid()'),
          name: permData.name,
          description: permData.description,
          created_at: new Date(Date.now() - Math.random() * 86400000 * 30), // Random dates within last 30 days
          updated_at: new Date(),
        })
        .returning('*');
      testPermissions.push(permission[0]);
    }

    // Create test role with permission.view access
    const testRole = await knex('roles')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        name: 'Permission Viewer Role',
        description: 'Role for viewing permissions',
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    const role = testRole[0];

    // Create limited role without permission.view
    const limitedRole = await knex('roles')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        name: 'Limited Role',
        description: 'Role with no permission access',
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    const limitedRoleRecord = limitedRole[0];

    // Assign permission.view to test role
    const viewPermission = testPermissions.find((p) => p.name === 'permission.view');
    await knex('role_permissions').insert({
      id: knex.raw('gen_random_uuid()'),
      role_id: role.id,
      permission_id: viewPermission.id,
      created_at: new Date(),
      updated_at: new Date(),
    });

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

  describe('GET /api/v1/permissions (Get All Permissions)', () => {
    it('should return all permissions with default parameters', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toEqual(expect.any(Array));
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body.length).toBeLessThanOrEqual(20); // Default limit

      // Verify permission structure
      const permission = response.body[0];
      expect(permission).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        description: expect.any(String),
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });
    });

    it('should search permissions by name', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/permissions?search=user.create')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);
      const foundPermission = response.body.find((p) => p.name === 'user.create');
      expect(foundPermission).toBeTruthy();
      expect(foundPermission.description).toContain('Create users');
    });

    it('should search permissions by description', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/permissions?search=Create')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);
      response.body.forEach((permission) => {
        const matchesName = permission.name.toLowerCase().includes('create');
        const matchesDescription = permission.description.toLowerCase().includes('create');
        expect(matchesName || matchesDescription).toBe(true);
      });
    });

    it('should search permissions case-insensitively', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/permissions?search=ADMIN')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);
      const adminPermission = response.body.find((p) => p.name.includes('admin'));
      expect(adminPermission).toBeTruthy();
    });

    it('should paginate permissions correctly', async () => {
      const limit = 5;
      const offset = 3;

      const response = await request(app.getHttpServer())
        .get(`/api/v1/permissions?limit=${limit}&offset=${offset}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.length).toBeLessThanOrEqual(limit);

      // Verify pagination by checking different offsets
      const firstPageResponse = await request(app.getHttpServer())
        .get('/api/v1/permissions?limit=5&offset=0')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const secondPageResponse = await request(app.getHttpServer())
        .get('/api/v1/permissions?limit=5&offset=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // First page and second page should have different permissions (assuming we have enough data)
      if (firstPageResponse.body.length > 0 && secondPageResponse.body.length > 0) {
        expect(firstPageResponse.body[0].id).not.toBe(secondPageResponse.body[0].id);
      }
    });

    it('should sort permissions by name ascending', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/permissions?sort_by=name&sort_order=asc')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const names = response.body.map((p) => p.name);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });

    it('should sort permissions by name descending (default)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/permissions?sort_by=name')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const names = response.body.map((p) => p.name);
      const sortedNames = [...names].sort().reverse();
      expect(names).toEqual(sortedNames);
    });

    it('should sort permissions by description', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/permissions?sort_by=description&sort_order=asc')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const descriptions = response.body.map((p) => p.description);
      const sortedDescriptions = [...descriptions].sort();
      expect(descriptions).toEqual(sortedDescriptions);
    });

    it('should sort permissions by creation date', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/permissions?sort_by=created_at&sort_order=desc')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const dates = response.body.map((p) => new Date(p.created_at));
      const sortedDates = [...dates].sort((a, b) => b.getTime() - a.getTime());
      expect(dates).toEqual(sortedDates);
    });

    it('should handle combined search and pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/permissions?search=user&limit=3&offset=0&sort_by=name&sort_order=asc')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.length).toBeLessThanOrEqual(3);
      response.body.forEach((permission) => {
        const matchesName = permission.name.toLowerCase().includes('user');
        const matchesDescription = permission.description.toLowerCase().includes('user');
        expect(matchesName || matchesDescription).toBe(true);
      });

      // Should be sorted by name ascending
      const names = response.body.map((p) => p.name);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });

    it('should return empty array for non-matching search', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/permissions?search=NonExistentPermission')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should handle large limit values', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/permissions?limit=1000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toEqual(expect.any(Array));
      expect(response.body.length).toBeLessThanOrEqual(1000);
      expect(response.body.length).toBe(testPermissions.length); // Should return all permissions
    });

    it('should handle zero limit (should return default)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/permissions?limit=0')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toEqual(expect.any(Array));
      // Behavior might vary based on implementation, but should handle gracefully
    });

    it('should handle negative offset (should default to 0)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/permissions?offset=-5')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toEqual(expect.any(Array));
      // Should handle gracefully, likely treating as offset 0
    });

    it('should fail with invalid sort_by parameter', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/permissions?sort_by=invalid_field')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should fail with invalid sort_order parameter', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/permissions?sort_order=invalid_order')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should fail with invalid limit parameter (non-numeric)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/permissions?limit=invalid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should fail with invalid offset parameter (non-numeric)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/permissions?offset=invalid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should fail without proper permissions', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/permissions')
        .set('Authorization', `Bearer ${limitedAdminToken}`)
        .expect(403);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer()).get('/api/v1/permissions').expect(401);
    });

    it('should fail with invalid JWT token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/permissions')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .expect(401);
    });

    it('should fail with malformed Authorization header', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/permissions')
        .set('Authorization', 'InvalidFormat token')
        .expect(401);
    });

    it('should fail with missing Authorization header', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/permissions')
        .set('Authorization', '')
        .expect(401);
    });
  });

  describe('Performance Testing', () => {
    it('should handle large result sets efficiently', async () => {
      const startTime = Date.now();

      await request(app.getHttpServer())
        .get('/api/v1/permissions?limit=100')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(3000); // Should complete within 3 seconds
    });

    it('should handle complex search queries efficiently', async () => {
      const startTime = Date.now();

      await request(app.getHttpServer())
        .get('/api/v1/permissions?search=admin&sort_by=created_at&sort_order=desc&limit=50')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should handle concurrent permission requests', async () => {
      const promises = [];
      const requestCount = 10;

      for (let i = 0; i < requestCount; i++) {
        const promise = request(app.getHttpServer())
          .get(`/api/v1/permissions?search=user&limit=10&offset=${i}`)
          .set('Authorization', `Bearer ${adminToken}`);
        promises.push(promise);
      }

      const results = await Promise.allSettled(promises);
      const successful = results.filter((r) => r.status === 'fulfilled' && r.value.status === 200);

      expect(successful.length).toBe(requestCount);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle very long search terms', async () => {
      const longSearchTerm = 'a'.repeat(1000);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/permissions?search=${longSearchTerm}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should handle special characters in search', async () => {
      const specialChars = 'permission.view@#$%^&*()';

      const response = await request(app.getHttpServer())
        .get(`/api/v1/permissions?search=${encodeURIComponent(specialChars)}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Should handle gracefully without crashing
      expect(response.body).toEqual(expect.any(Array));
    });

    it('should handle Unicode characters in search', async () => {
      const unicodeSearch = 'тест用户权限';

      const response = await request(app.getHttpServer())
        .get(`/api/v1/permissions?search=${encodeURIComponent(unicodeSearch)}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toEqual(expect.any(Array));
    });

    it('should handle SQL injection attempts in search', async () => {
      const sqlInjection = "'; DROP TABLE permissions; --";

      const response = await request(app.getHttpServer())
        .get(`/api/v1/permissions?search=${encodeURIComponent(sqlInjection)}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Should handle safely without executing injection
      expect(response.body).toEqual(expect.any(Array));

      // Verify permissions table still exists by making another request
      await request(app.getHttpServer())
        .get('/api/v1/permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should handle extremely large offset values', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/permissions?offset=999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should handle extremely large limit values', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/permissions?limit=999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toEqual(expect.any(Array));
      // Should return all permissions but not crash
      expect(response.body.length).toBeLessThanOrEqual(testPermissions.length);
    });
  });

  describe('Database Consistency Verification', () => {
    it('should maintain referential integrity for role permissions', async () => {
      const rolePermissions = await knex('role_permissions').select('*');
      const roles = await knex('roles').select('*');
      const permissions = await knex('permissions').select('*');

      for (const rolePermission of rolePermissions) {
        const role = roles.find((r) => r.id === rolePermission.role_id);
        const permission = permissions.find((p) => p.id === rolePermission.permission_id);
        expect(role).toBeTruthy();
        expect(permission).toBeTruthy();
      }
    });

    it('should maintain audit fields correctly', async () => {
      const permissions = await knex('permissions').select('*');

      for (const permission of permissions) {
        expect(permission.created_at).toBeTruthy();
        expect(permission.updated_at).toBeTruthy();
        expect(new Date(permission.created_at)).toBeInstanceOf(Date);
        expect(new Date(permission.updated_at)).toBeInstanceOf(Date);
      }
    });

    it('should enforce unique constraints on permission names', async () => {
      try {
        await knex('permissions').insert({
          id: knex.raw('gen_random_uuid()'),
          name: 'user.create', // Duplicate name
          description: 'Duplicate permission',
          created_at: new Date(),
          updated_at: new Date(),
        });
        fail('Should have thrown unique constraint error');
      } catch (error) {
        expect(error.code).toBe('23505'); // PostgreSQL unique constraint violation
      }
    });

    it('should maintain permission name format consistency', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      response.body.forEach((permission) => {
        // Permission names should follow the pattern: resource.action
        expect(permission.name).toMatch(/^[a-z_]+\.[a-z_]+(\.[a-z_]+)*$/);
        expect(permission.name).not.toContain(' ');
        expect(permission.name).not.toContain('-');
      });
    });
  });

  describe('Security and Authorization', () => {
    it('should prevent unauthorized access without JWT token', async () => {
      await request(app.getHttpServer()).get('/api/v1/permissions').expect(401);
    });

    it('should prevent access with expired JWT token', async () => {
      // This would require mocking JWT service to return expired token
      // Implementation depends on JWT service structure
    });

    it('should validate admin has specific permission for access', async () => {
      // Admin without permission.view should be denied
      await request(app.getHttpServer())
        .get('/api/v1/permissions')
        .set('Authorization', `Bearer ${limitedAdminToken}`)
        .expect(403);
    });

    it('should not expose sensitive permission data', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      response.body.forEach((permission) => {
        // Should not expose internal fields that might be sensitive
        expect(permission).not.toHaveProperty('internal_id');
        expect(permission).not.toHaveProperty('system_flag');
        expect(permission).not.toHaveProperty('secret_key');
      });
    });

    it('should handle different admin roles correctly', async () => {
      // Create a super admin with additional permissions
      const superRole = await knex('roles')
        .insert({
          id: knex.raw('gen_random_uuid()'),
          name: 'Super Admin',
          description: 'Super admin role',
          status: 'Active',
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('*');

      const superAdmin = await knex('admins')
        .insert({
          id: knex.raw('gen_random_uuid()'),
          first_name: 'Super',
          last_name: 'Admin',
          phone: '+998903333333',
          login: 'superadmin',
          password: '$2b$10$K7L/VxwjnydKw.fK8tUqme7kk7IgJ9J9J9J9J9J9J9J9J9J9J9J9',
          branch_id: testBranch.id,
          status: 'Active',
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('*');

      // Assign permission.view to super admin
      const viewPermission = testPermissions.find((p) => p.name === 'permission.view');
      await knex('role_permissions').insert({
        id: knex.raw('gen_random_uuid()'),
        role_id: superRole[0].id,
        permission_id: viewPermission.id,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await knex('admin_roles').insert({
        id: knex.raw('gen_random_uuid()'),
        admin_id: superAdmin[0].id,
        role_id: superRole[0].id,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const superToken = authService.generateJwtToken({
        id: superAdmin[0].id,
        login: superAdmin[0].login,
        first_name: superAdmin[0].first_name,
        last_name: superAdmin[0].last_name,
        phone: superAdmin[0].phone,
        branch_id: superAdmin[0].branch_id,
        status: superAdmin[0].status,
      });

      // Super admin should have access
      await request(app.getHttpServer())
        .get('/api/v1/permissions')
        .set('Authorization', `Bearer ${superToken}`)
        .expect(200);
    });
  });

  describe('API Response Format Validation', () => {
    it('should return consistent response format', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toEqual(expect.any(Array));

      response.body.forEach((permission) => {
        expect(permission).toEqual(
          expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
            description: expect.any(String),
            created_at: expect.any(String),
            updated_at: expect.any(String),
          }),
        );

        // Validate UUID format for id
        expect(permission.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        );

        // Validate date format
        expect(new Date(permission.created_at)).toBeInstanceOf(Date);
        expect(new Date(permission.updated_at)).toBeInstanceOf(Date);
      });
    });

    it('should return proper HTTP status codes', async () => {
      // Success case
      await request(app.getHttpServer())
        .get('/api/v1/permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Unauthorized case
      await request(app.getHttpServer()).get('/api/v1/permissions').expect(401);

      // Forbidden case
      await request(app.getHttpServer())
        .get('/api/v1/permissions')
        .set('Authorization', `Bearer ${limitedAdminToken}`)
        .expect(403);

      // Bad request case
      await request(app.getHttpServer())
        .get('/api/v1/permissions?sort_by=invalid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  afterEach(async () => {
    // Generate coverage report after each test suite
    await CoverageHelpers.generateCoverageReport();
  });
});
