import { TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AdminsService } from 'src/admins/admins.service';
import { AuthService } from 'src/auth/auth.service';
import { TestModuleBuilder } from '../../utils/test-module-builder';
import { CoverageHelpers } from '../../utils/coverage-helpers';
import { Knex } from 'knex';
import Redis from 'ioredis';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { AppModule } from 'src/app.module';

interface AdminResponse {
  id: string;
  first_name: string;
  last_name: string;
  login: string;
  phone: string;
  branch_id: string;
  status: string;
  password?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

interface PaginatedAdminsResponse {
  rows: AdminResponse[];
  total: number;
  limit: number;
  offset: number;
}

interface BranchResponse {
  id: string;
  name: string;
  address: string;
  phone: string;
  status: string;
}

interface RoleResponse {
  id: string;
  name: string;
}

describe('Admins Controller Complete E2E', () => {
  let app: INestApplication;
  let authService: AuthService;
  let adminsService: AdminsService;
  let knex: Knex;
  let redis: Redis;
  let adminToken: string;
  let superAdminToken: string;
  let testAdmin: AdminResponse;
  let testSuperAdmin: AdminResponse;
  let testBranch: BranchResponse;
  let testRole: RoleResponse;
  let secondTestAdmin: AdminResponse;

  beforeAll(async () => {
    const moduleBuilder = new TestModuleBuilder();
    const module: TestingModule = await moduleBuilder
      .addImports([AppModule])
      .withRealDatabase()
      .withRealRedis()
      .withExternalServiceMocks()
      .build();

    app = module.createNestApplication();
    await app.init();

    // Get services
    authService = module.get<AuthService>(AuthService);
    adminsService = module.get<AdminsService>(AdminsService);
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

  async function setupTestData(): Promise<void> {
    // Create test branch
    const branches = await knex('branches')
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
    testBranch = branches[0] as unknown as BranchResponse;

    // Create permissions
    const permissions = [
      'admin.manage.view_all',
      'admin.manage.view_details',
      'admin.manage.create',
      'admin.manage.update',
      'admin.manage.delete',
      'admin.profile.edit.basic',
      'admin.profile.edit.sensitive',
    ];

    for (const permission of permissions) {
      await knex('permissions').insert({
        id: knex.raw('gen_random_uuid()'),
        name: permission,
        description: `Permission for ${permission}`,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    // Create test role with all admin permissions
    const roles = await knex('roles')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        name: 'Test Role',
        description: 'Role for testing',
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    testRole = roles[0] as unknown as RoleResponse;

    // Create super admin role
    const superRoles = await knex('roles')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        name: 'Super Admin',
        description: 'Super admin role',
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    const superRoleRecord = superRoles[0];

    // Assign permissions to roles
    const allPermissions = await knex('permissions').select('*');
    for (const permission of allPermissions) {
      await knex('role_permissions').insert({
        id: knex.raw('gen_random_uuid()'),
        role_id: testRole.id,
        permission_id: permission.id,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await knex('role_permissions').insert({
        id: knex.raw('gen_random_uuid()'),
        role_id: superRoleRecord.id,
        permission_id: permission.id,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    // Create test admins
    const admins1 = await knex('admins')
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
    testAdmin = admins1[0] as unknown as AdminResponse;

    const admins2 = await knex('admins')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        first_name: 'Super',
        last_name: 'Admin',
        phone: '+998902222222',
        login: 'superadmin',
        password: '$2b$10$K7L/VxwjnydKw.fK8tUqme7kk7IgJ9J9J9J9J9J9J9J9J9J9J9J9',
        branch_id: testBranch.id,
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    testSuperAdmin = admins2[0] as unknown as AdminResponse;

    const admins3 = await knex('admins')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        first_name: 'Second',
        last_name: 'Admin',
        phone: '+998903333333',
        login: 'secondadmin',
        password: '$2b$10$K7L/VxwjnydKw.fK8tUqme7kk7IgJ9J9J9J9J9J9J9J9J9J9J9J9',
        branch_id: testBranch.id,
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    secondTestAdmin = admins3[0] as unknown as AdminResponse;

    // Assign roles to admins
    await knex('admin_roles').insert({
      id: knex.raw('gen_random_uuid()'),
      admin_id: testAdmin.id,
      role_id: testRole.id,
      created_at: new Date(),
      updated_at: new Date(),
    });

    await knex('admin_roles').insert({
      id: knex.raw('gen_random_uuid()'),
      admin_id: testSuperAdmin.id,
      role_id: superRoleRecord.id,
      created_at: new Date(),
      updated_at: new Date(),
    });

    await knex('admin_roles').insert({
      id: knex.raw('gen_random_uuid()'),
      admin_id: secondTestAdmin.id,
      role_id: testRole.id,
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

    superAdminToken = authService.generateJwtToken({
      id: testSuperAdmin.id,
      login: testSuperAdmin.login,
      first_name: testSuperAdmin.first_name,
      last_name: testSuperAdmin.last_name,
      phone: testSuperAdmin.phone,
      branch_id: testSuperAdmin.branch_id,
      status: testSuperAdmin.status,
    });
  }

  describe('GET /api/v1/admins/me (Get Profile)', () => {
    it('should return admin profile successfully', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admins/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toEqual({
        id: testAdmin.id,
        first_name: testAdmin.first_name,
        last_name: testAdmin.last_name,
        login: testAdmin.login,
        phone: testAdmin.phone,
        branch_id: testAdmin.branch_id,
        status: testAdmin.status,
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer()).get('/api/v1/admins/me').expect(401);
    });

    it('should fail with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admins/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('POST /api/v1/admins/change-password (Change Password)', () => {
    it('should change password successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/admins/change-password')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          current_password: 'password123',
          new_password: 'newPassword456',
          confirm_password: 'newPassword456',
        })
        .expect(201);

      expect(response.body).toEqual({
        message: 'Password changed successfully',
      });

      // Verify password was changed in database
      const updatedAdmin = await knex('admins').where('id', testAdmin.id).first();
      expect(updatedAdmin.password).not.toBe(testAdmin.password);
    });

    it('should fail with incorrect current password', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/admins/change-password')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          current_password: 'wrongPassword',
          new_password: 'newPassword456',
          confirm_password: 'newPassword456',
        })
        .expect(400);

      expect(response.body.message).toContain('Current password is incorrect');
    });

    it('should fail when new passwords do not match', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/admins/change-password')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          current_password: 'password123',
          new_password: 'newPassword456',
          confirm_password: 'differentPassword',
        })
        .expect(400);
    });

    it('should fail with weak password', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/admins/change-password')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          current_password: 'password123',
          new_password: '123',
          confirm_password: '123',
        })
        .expect(400);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/admins/change-password')
        .send({
          current_password: 'password123',
          new_password: 'newPassword456',
          confirm_password: 'newPassword456',
        })
        .expect(401);
    });
  });

  describe('POST /api/v1/admins (Create Admin)', () => {
    it('should create admin successfully with proper permissions', async () => {
      const newAdminData = {
        first_name: 'New',
        last_name: 'Admin',
        phone: '+998904444444',
        login: 'newadmin',
        branch_id: testBranch.id,
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/admins')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(newAdminData)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        first_name: newAdminData.first_name,
        last_name: newAdminData.last_name,
        phone: newAdminData.phone,
        login: newAdminData.login,
        branch_id: newAdminData.branch_id,
        status: 'Active',
      });

      // Verify admin was created in database
      const createdAdmin = await knex('admins')
        .where('id', (response.body as AdminResponse).id)
        .first();
      expect(createdAdmin).toBeTruthy();
      expect(createdAdmin.phone).toBe(newAdminData.phone);
    });

    it('should fail without proper permissions', async () => {
      // Create an admin without admin.manage.create permission
      await knex('admin_role_permissions').where('admin_id', testAdmin.id).del();

      await request(app.getHttpServer())
        .post('/api/v1/admins')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          first_name: 'Test',
          last_name: 'Admin',
          phone: '+998905555555',
          login: 'testadmin2',
          branch_id: testBranch.id,
        })
        .expect(403);
    });

    it('should fail with duplicate phone number', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/admins')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          first_name: 'Duplicate',
          last_name: 'Admin',
          phone: testAdmin.phone, // Same phone as existing admin
          login: 'duplicateadmin',
          branch_id: testBranch.id,
        })
        .expect(400);
    });

    it('should fail with duplicate login', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/admins')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          first_name: 'Duplicate',
          last_name: 'Admin',
          phone: '+998906666666',
          login: testAdmin.login, // Same login as existing admin
          branch_id: testBranch.id,
        })
        .expect(400);
    });

    it('should fail with invalid branch ID', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/admins')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          first_name: 'Invalid',
          last_name: 'Branch',
          phone: '+998907777777',
          login: 'invalidbranch',
          branch_id: '00000000-0000-4000-8000-000000000000',
        })
        .expect(404);
    });

    it('should fail with invalid data validation', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/admins')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          first_name: '', // Empty first name
          last_name: 'Admin',
          phone: 'invalid-phone', // Invalid phone format
          login: 'ab', // Too short login
          branch_id: 'invalid-uuid', // Invalid UUID
        })
        .expect(400);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/admins')
        .send({
          first_name: 'Test',
          last_name: 'Admin',
          phone: '+998908888888',
          login: 'testadmin3',
          branch_id: testBranch.id,
        })
        .expect(401);
    });
  });

  describe('PATCH /api/v1/admins/:id (Update Admin)', () => {
    it('should update admin successfully with proper permissions', async () => {
      const updateData = {
        first_name: 'Updated',
        last_name: 'Name',
        phone: '+998909999999',
      };

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/admins/${secondTestAdmin.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Admin updated successfully',
      });

      // Verify admin was updated in database
      const updatedAdmin = await knex('admins').where('id', secondTestAdmin.id).first();
      expect(updatedAdmin.first_name).toBe(updateData.first_name);
      expect(updatedAdmin.last_name).toBe(updateData.last_name);
      expect(updatedAdmin.phone).toBe(updateData.phone);
    });

    it('should allow admin to update their own basic profile', async () => {
      const updateData = {
        first_name: 'Self Updated',
      };

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/admins/${testAdmin.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Admin updated successfully',
      });
    });

    it('should fail when updating non-existent admin', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/admins/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          first_name: 'Non-existent',
        })
        .expect(404);
    });

    it('should fail without proper permissions', async () => {
      // Remove permissions from test admin
      await knex('admin_role_permissions').where('admin_id', testAdmin.id).del();

      await request(app.getHttpServer())
        .patch(`/api/v1/admins/${secondTestAdmin.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          first_name: 'Unauthorized Update',
        })
        .expect(403);
    });

    it('should fail with invalid UUID format', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/admins/invalid-uuid')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          first_name: 'Invalid',
        })
        .expect(400);
    });

    it('should fail with duplicate phone number', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/admins/${secondTestAdmin.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          phone: testAdmin.phone, // Trying to use existing phone
        })
        .expect(400);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/admins/${secondTestAdmin.id}`)
        .send({
          first_name: 'Unauthorized',
        })
        .expect(401);
    });
  });

  describe('DELETE /api/v1/admins/:id (Delete Admin)', () => {
    it('should delete admin successfully with proper permissions', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/v1/admins/${secondTestAdmin.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Admin deleted successfully',
      });

      // Verify admin was soft deleted in database
      const deletedAdmin = await knex('admins').where('id', secondTestAdmin.id).first();
      expect(deletedAdmin.deleted_at).toBeTruthy();
    });

    it('should fail when deleting non-existent admin', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/admins/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);
    });

    it('should fail when trying to delete already deleted admin', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/admins/${secondTestAdmin.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);
    });

    it('should fail without proper permissions', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/admins/${testAdmin.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
    });

    it('should fail with invalid UUID format', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/admins/invalid-uuid')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer()).delete(`/api/v1/admins/${testAdmin.id}`).expect(401);
    });
  });

  describe('GET /api/v1/admins (Get All Admins)', () => {
    beforeEach(async () => {
      // Ensure we have clean test data
      await knex.raw('DELETE FROM admins WHERE deleted_at IS NOT NULL');

      // Create additional test admins
      for (let i = 1; i <= 5; i++) {
        await knex('admins').insert({
          id: knex.raw('gen_random_uuid()'),
          first_name: `Admin${i}`,
          last_name: `Test${i}`,
          phone: `+99890${i}111111`,
          login: `admin${i}`,
          password: '$2b$10$K7L/VxwjnydKw.fK8tUqme7kk7IgJ9J9J9J9J9J9J9J9J9J9J9J9',
          branch_id: testBranch.id,
          status: i % 2 === 0 ? 'Active' : 'Inactive',
          created_at: new Date(Date.now() - i * 86400000), // Different creation dates
          updated_at: new Date(),
        });
      }
    });

    it('should return all admins with default pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admins')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const body = response.body as PaginatedAdminsResponse;

      expect(body).toMatchObject({
        rows: expect.any(Array),
        total: expect.any(Number),
        limit: expect.any(Number),
        offset: expect.any(Number),
      });

      expect(body.rows.length).toBeGreaterThan(0);
      expect(body.total).toBeGreaterThanOrEqual(body.rows.length);
    });

    it('should filter admins by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admins?status=Active')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const body = response.body as PaginatedAdminsResponse;

      expect(body.rows).toEqual(
        expect.arrayContaining([expect.objectContaining({ status: 'Active' })]),
      );

      // Ensure no inactive admins are returned
      const inactiveAdmins = body.rows.filter((admin) => admin.status !== 'Active');
      expect(inactiveAdmins).toHaveLength(0);
    });

    it('should filter admins by branch_id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/admins?branch_id=${testBranch.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const body = response.body as PaginatedAdminsResponse;

      expect(body.rows).toEqual(
        expect.arrayContaining([expect.objectContaining({ branch_id: testBranch.id })]),
      );
    });

    it('should search admins by name', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admins?search=Test Admin')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const body = response.body as PaginatedAdminsResponse;

      expect(body.rows.length).toBeGreaterThan(0);
      expect(body.rows[0]).toMatchObject({
        first_name: 'Test',
        last_name: 'Admin',
      });
    });

    it('should search admins by phone', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/admins?search=${testAdmin.phone}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const body = response.body as PaginatedAdminsResponse;

      expect(body.rows.length).toBeGreaterThan(0);
      expect(body.rows[0].phone).toBe(testAdmin.phone);
    });

    it('should paginate results correctly', async () => {
      const limit = 3;
      const offset = 2;

      const response = await request(app.getHttpServer())
        .get(`/api/v1/admins?limit=${limit}&offset=${offset}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const body = response.body as PaginatedAdminsResponse;

      expect(body.limit).toBe(limit);
      expect(body.offset).toBe(offset);
      expect(body.rows.length).toBeLessThanOrEqual(limit);
    });

    it('should sort admins by creation date', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admins?sort_by=created_at&sort_order=desc')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const body = response.body as PaginatedAdminsResponse;

      const dates = body.rows.map((admin) => new Date(admin.created_at));
      const sortedDates = [...dates].sort((a, b) => b.getTime() - a.getTime());
      expect(dates).toEqual(sortedDates);
    });

    it('should handle combined filters and pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admins?status=Active&limit=2&offset=0&sort_by=first_name&sort_order=asc')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const body = response.body as PaginatedAdminsResponse;

      expect(body.rows.length).toBeLessThanOrEqual(2);
      expect(body.rows).toEqual(
        expect.arrayContaining([expect.objectContaining({ status: 'Active' })]),
      );
    });

    it('should return empty results for non-matching filters', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admins?search=NonExistentAdmin')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const body = response.body as PaginatedAdminsResponse;

      expect(body.rows).toHaveLength(0);
      expect(body.total).toBe(0);
    });

    it('should fail without proper permissions', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admins')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
    });

    it('should fail with invalid query parameters', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admins?limit=invalid')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer()).get('/api/v1/admins').expect(401);
    });
  });

  describe('Database Consistency Verification', () => {
    it('should maintain referential integrity for admins and branches', async () => {
      const admins = await knex('admins').select('*');
      const branches = await knex('branches').select('*');

      for (const admin of admins) {
        if (admin.branch_id) {
          const branch = branches.find((b: { id: string }) => b.id === admin.branch_id);
          expect(branch).toBeTruthy();
        }
      }
    });

    it('should maintain audit fields correctly', async () => {
      const admins = await knex('admins').select('*');

      for (const admin of admins) {
        expect(admin.created_at).toBeTruthy();
        expect(admin.updated_at).toBeTruthy();
        expect(new Date(admin.created_at as string | number | Date)).toBeInstanceOf(Date);
        expect(new Date(admin.updated_at as string | number | Date)).toBeInstanceOf(Date);
      }
    });

    it('should properly handle soft deletes', async () => {
      // Delete an admin
      const requestingAdmin: AdminPayload = {
        id: testSuperAdmin.id,
        phone_number: testSuperAdmin.phone,
        roles: [],
      };
      await adminsService.delete(requestingAdmin, testAdmin.id);

      // Verify admin is soft deleted
      const deletedAdmin = await knex('admins').where('id', testAdmin.id).first();
      expect(deletedAdmin.deleted_at).toBeTruthy();

      // Verify admin doesn't appear in active queries
      const activeAdmins = await knex('admins').whereNull('deleted_at');
      expect(activeAdmins.find((a: AdminResponse) => a.id === testAdmin.id)).toBeFalsy();
    });
  });

  describe('Security and Authorization', () => {
    it('should prevent unauthorized access to protected endpoints', async () => {
      const endpoints: Array<{ method: 'get' | 'post' | 'patch' | 'delete'; path: string }> = [
        { method: 'post', path: '/api/v1/admins' },
        { method: 'patch', path: `/api/v1/admins/${testAdmin.id}` },
        { method: 'delete', path: `/api/v1/admins/${testAdmin.id}` },
        { method: 'get', path: '/api/v1/admins' },
      ];

      for (const endpoint of endpoints) {
        await request(app.getHttpServer())[endpoint.method](endpoint.path).expect(401);
      }
    });

    it('should validate JWT token format', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admins/me')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .expect(401);
    });

    it('should handle expired tokens', async () => {
      // This would require mocking JWT service to return expired token
      // Implementation depends on JWT service structure
    });

    it('should validate admin permissions for each operation', async () => {
      // Remove all permissions from admin
      await knex('admin_role_permissions').where('admin_id', testAdmin.id).del();

      const protectedEndpoints: Array<{
        method: 'get' | 'post' | 'patch' | 'delete';
        path: string;
        data?: object;
      }> = [
        { method: 'post', path: '/api/v1/admins', data: {} },
        { method: 'patch', path: `/api/v1/admins/${testAdmin.id}`, data: {} },
        { method: 'delete', path: `/api/v1/admins/${testAdmin.id}` },
        { method: 'get', path: '/api/v1/admins' },
      ];

      for (const endpoint of protectedEndpoints) {
        const req = request(app.getHttpServer())
          [endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${adminToken}`);

        if (endpoint.data) {
          await req.send(endpoint.data).expect(403);
        } else {
          await req.expect(403);
        }
      }
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle concurrent admin creation requests', async () => {
      const promises: Promise<request.Response>[] = [];
      const adminCount = 10;

      for (let i = 0; i < adminCount; i++) {
        const promise = request(app.getHttpServer())
          .post('/api/v1/admins')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({
            first_name: `Concurrent${i}`,
            last_name: `Admin${i}`,
            phone: `+99890${1000 + i}`,
            login: `concurrent${i}`,
            branch_id: testBranch.id,
          });
        promises.push(promise);
      }

      const results = await Promise.allSettled(promises);
      const successful = results.filter(
        (r): r is PromiseFulfilledResult<request.Response> =>
          r.status === 'fulfilled' && r.value.status === 201,
      );

      expect(successful.length).toBe(adminCount);
    });

    it('should handle large paginated requests efficiently', async () => {
      const startTime = Date.now();

      await request(app.getHttpServer())
        .get('/api/v1/admins?limit=100')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  afterEach(async () => {
    // Generate coverage report after each test suite
    await CoverageHelpers.generateCoverageReport();
  });
});
