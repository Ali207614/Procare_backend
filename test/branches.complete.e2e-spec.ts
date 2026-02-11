import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { BranchesService } from '../src/branches/branches.service';
import { AuthService } from '../src/auth/auth.service';
import { TestModuleBuilder } from './utils/test-module-builder';
import { CoverageHelpers } from './utils/coverage-helpers';

describe('Branches Controller Complete E2E', () => {
  let app: INestApplication;
  let authService: AuthService;
  let branchesService: BranchesService;
  let knex: any;
  let redis: any;
  let adminToken: string;
  let limitedAdminToken: string;
  let testAdmin: any;
  let limitedAdmin: any;
  let testBranch: any;
  let secondTestBranch: any;
  let testRole: any;

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
    branchesService = module.get<BranchesService>(BranchesService);
    knex = module.get('KNEX_CONNECTION');
    redis = module.get('REDIS_CLIENT');

    // Clean database and cache
    await knex.raw('DELETE FROM branch_admin_assignments');
    await knex.raw('DELETE FROM repair_orders');
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
    await knex.raw('DELETE FROM branch_admin_assignments');
    await knex.raw('DELETE FROM repair_orders');
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
    // Create branch permissions
    const branchPermissions = [
      'branch.create',
      'branch.view',
      'branch.update',
      'branch.delete',
      'branch.assign.admins',
    ];

    for (const permission of branchPermissions) {
      await knex('permissions').insert({
        id: knex.raw('gen_random_uuid()'),
        name: permission,
        description: `Permission for ${permission}`,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    // Create test role with all branch permissions
    testRole = await knex('roles')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        name: 'Branch Manager Role',
        description: 'Role for managing branches',
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    testRole = testRole[0];

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

      // Only assign view permission to limited role
      if (permission.name === 'branch.view') {
        await knex('role_permissions').insert({
          id: knex.raw('gen_random_uuid()'),
          role_id: limitedRoleRecord.id,
          permission_id: permission.id,
          created_at: new Date(),
          updated_at: new Date(),
        });
      }
    }

    // Create test branches
    testBranch = await knex('branches')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        name: 'Main Branch',
        address: '123 Main Street',
        phone: '+998901234567',
        status: 'Open',
        sort: 1,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    testBranch = testBranch[0];

    secondTestBranch = await knex('branches')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        name: 'Second Branch',
        address: '456 Second Street',
        phone: '+998902345678',
        status: 'Open',
        sort: 2,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    secondTestBranch = secondTestBranch[0];

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
      role_id: testRole.id,
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

  describe('POST /api/v1/branches (Create Branch)', () => {
    it('should create branch successfully with proper permissions', async () => {
      const newBranchData = {
        name: 'New Branch',
        address: '789 New Street',
        phone: '+998903456789',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/branches')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newBranchData)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        name: newBranchData.name,
        address: newBranchData.address,
        phone: newBranchData.phone,
        status: 'Open',
        sort: expect.any(Number),
      });

      // Verify branch was created in database
      const createdBranch = await knex('branches').where('id', response.body.id).first();
      expect(createdBranch).toBeTruthy();
      expect(createdBranch.name).toBe(newBranchData.name);
    });

    it('should fail with duplicate branch name', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/branches')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: testBranch.name, // Same name as existing branch
          address: 'Different Address',
          phone: '+998904567890',
        })
        .expect(400);
    });

    it('should fail with duplicate phone number', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/branches')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Unique Name',
          address: 'Unique Address',
          phone: testBranch.phone, // Same phone as existing branch
        })
        .expect(400);
    });

    it('should fail with invalid data validation', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/branches')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '', // Empty name
          address: 'Valid Address',
          phone: 'invalid-phone', // Invalid phone format
        })
        .expect(400);
    });

    it('should fail without proper permissions', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/branches')
        .set('Authorization', `Bearer ${limitedAdminToken}`)
        .send({
          name: 'Unauthorized Branch',
          address: 'Some Address',
          phone: '+998905678901',
        })
        .expect(403);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/branches')
        .send({
          name: 'No Auth Branch',
          address: 'Some Address',
          phone: '+998906789012',
        })
        .expect(401);
    });
  });

  describe('GET /api/v1/branches (Get All Branches)', () => {
    beforeEach(async () => {
      // Create additional test branches for pagination tests
      for (let i = 1; i <= 5; i++) {
        await knex('branches').insert({
          id: knex.raw('gen_random_uuid()'),
          name: `Branch ${i}`,
          address: `${i} Test Street`,
          phone: `+99890${3000 + i}`,
          status: i % 2 === 0 ? 'Open' : 'Closed',
          sort: i + 10,
          created_at: new Date(Date.now() - i * 86400000),
          updated_at: new Date(),
        });
      }
    });

    it('should return all branches with default pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/branches')
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
    });

    it('should search branches by name', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/branches?search=Main Branch')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].name).toBe('Main Branch');
    });

    it('should paginate results correctly', async () => {
      const limit = 3;
      const offset = 2;

      const response = await request(app.getHttpServer())
        .get(`/api/v1/branches?limit=${limit}&offset=${offset}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.meta.limit).toBe(limit);
      expect(response.body.meta.offset).toBe(offset);
      expect(response.body.data.length).toBeLessThanOrEqual(limit);
    });

    it('should return branches sorted by sort field', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/branches')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const sorts = response.body.data.map((branch) => branch.sort);
      const sortedSorts = [...sorts].sort((a, b) => a - b);
      expect(sorts).toEqual(sortedSorts);
    });

    it('should return empty results for non-matching search', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/branches?search=NonExistentBranch')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(0);
      expect(response.body.meta.total).toBe(0);
    });

    it('should fail with invalid query parameters', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/branches?limit=invalid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should fail without proper permissions', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/branches')
        .set('Authorization', `Bearer ${limitedAdminToken}`)
        .expect(200); // Limited admin has branch.view permission
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer()).get('/api/v1/branches').expect(401);
    });
  });

  describe('GET /api/v1/branches/viewable (Get My Branches)', () => {
    beforeEach(async () => {
      // Assign admin to specific branches
      await knex('branch_admin_assignments').insert({
        id: knex.raw('gen_random_uuid()'),
        branch_id: testBranch.id,
        admin_id: testAdmin.id,
        created_at: new Date(),
        updated_at: new Date(),
      });
    });

    it('should return branches assigned to current admin', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/branches/viewable')
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

      // Should return at least the assigned branch
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should paginate assigned branches correctly', async () => {
      const limit = 1;
      const offset = 0;

      const response = await request(app.getHttpServer())
        .get(`/api/v1/branches/viewable?limit=${limit}&offset=${offset}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.meta.limit).toBe(limit);
      expect(response.body.meta.offset).toBe(offset);
      expect(response.body.data.length).toBeLessThanOrEqual(limit);
    });

    it('should return empty if admin has no assigned branches', async () => {
      // Remove branch assignments for limited admin
      await knex('branch_admin_assignments').where('admin_id', limitedAdmin.id).del();

      const response = await request(app.getHttpServer())
        .get('/api/v1/branches/viewable')
        .set('Authorization', `Bearer ${limitedAdminToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(0);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer()).get('/api/v1/branches/viewable').expect(401);
    });
  });

  describe('GET /api/v1/branches/:branch_id (Get Branch by ID)', () => {
    it('should return branch with assigned admins successfully', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/branches/${testBranch.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: testBranch.id,
        name: testBranch.name,
        address: testBranch.address,
        phone: testBranch.phone,
        status: testBranch.status,
        sort: testBranch.sort,
        admins: expect.any(Array),
      });
    });

    it('should return branch without admins if none assigned', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/branches/${secondTestBranch.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.admins).toHaveLength(0);
    });

    it('should fail when getting non-existent branch', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/branches/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should fail with invalid UUID format', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/branches/invalid-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should fail without proper permissions', async () => {
      // Remove branch.view permission from limited admin
      await knex('role_permissions')
        .join('permissions', 'permissions.id', 'role_permissions.permission_id')
        .where('permissions.name', 'branch.view')
        .andWhere(
          'role_permissions.role_id',
          (await knex('admin_roles').where('admin_id', limitedAdmin.id).first()).role_id,
        )
        .del();

      await request(app.getHttpServer())
        .get(`/api/v1/branches/${testBranch.id}`)
        .set('Authorization', `Bearer ${limitedAdminToken}`)
        .expect(403);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer()).get(`/api/v1/branches/${testBranch.id}`).expect(401);
    });
  });

  describe('PATCH /api/v1/branches/:branch_id/sort (Update Branch Sort)', () => {
    it('should update branch sort successfully', async () => {
      const newSort = 100;

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/branches/${testBranch.id}/sort`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ sort: newSort })
        .expect(200);

      expect(response.body).toEqual({
        message: 'Sort updated successfully',
      });

      // Verify sort was updated in database
      const updatedBranch = await knex('branches').where('id', testBranch.id).first();
      expect(updatedBranch.sort).toBe(newSort);
    });

    it('should fail with invalid sort value', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/branches/${testBranch.id}/sort`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ sort: -1 }) // Negative sort value
        .expect(400);
    });

    it('should fail when updating non-existent branch', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/branches/00000000-0000-4000-8000-000000000000/sort')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ sort: 50 })
        .expect(404);
    });

    it('should fail without proper permissions', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/branches/${testBranch.id}/sort`)
        .set('Authorization', `Bearer ${limitedAdminToken}`)
        .send({ sort: 50 })
        .expect(403);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/branches/${testBranch.id}/sort`)
        .send({ sort: 50 })
        .expect(401);
    });
  });

  describe('PATCH /api/v1/branches/:branch_id (Update Branch)', () => {
    it('should update branch successfully', async () => {
      const updateData = {
        name: 'Updated Main Branch',
        address: 'Updated Address',
        phone: '+998999999999',
        status: 'Closed',
      };

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/branches/${testBranch.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Branch updated successfully',
      });

      // Verify branch was updated in database
      const updatedBranch = await knex('branches').where('id', testBranch.id).first();
      expect(updatedBranch.name).toBe(updateData.name);
      expect(updatedBranch.address).toBe(updateData.address);
      expect(updatedBranch.phone).toBe(updateData.phone);
      expect(updatedBranch.status).toBe(updateData.status);
    });

    it('should update partial branch data', async () => {
      const updateData = {
        name: 'Partially Updated Branch',
      };

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/branches/${secondTestBranch.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Branch updated successfully',
      });

      // Verify only specified field was updated
      const updatedBranch = await knex('branches').where('id', secondTestBranch.id).first();
      expect(updatedBranch.name).toBe(updateData.name);
      expect(updatedBranch.address).toBe(secondTestBranch.address); // Should remain unchanged
    });

    it('should fail when updating non-existent branch', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/branches/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Non-existent Branch',
        })
        .expect(404);
    });

    it('should fail with duplicate name', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/branches/${secondTestBranch.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: testBranch.name, // Trying to use existing name
        })
        .expect(400);
    });

    it('should fail with duplicate phone', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/branches/${secondTestBranch.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          phone: testBranch.phone, // Trying to use existing phone
        })
        .expect(400);
    });

    it('should fail without proper permissions', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/branches/${testBranch.id}`)
        .set('Authorization', `Bearer ${limitedAdminToken}`)
        .send({
          name: 'Unauthorized Update',
        })
        .expect(403);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/branches/${testBranch.id}`)
        .send({
          name: 'No Auth Update',
        })
        .expect(401);
    });
  });

  describe('DELETE /api/v1/branches/:branch_id (Delete Branch)', () => {
    it('should delete branch successfully', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/v1/branches/${secondTestBranch.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Branch deleted successfully',
      });

      // Verify branch was soft deleted in database
      const deletedBranch = await knex('branches').where('id', secondTestBranch.id).first();
      expect(deletedBranch.deleted_at).toBeTruthy();
    });

    it('should fail when deleting non-existent branch', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/branches/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should fail when trying to delete already deleted branch', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/branches/${secondTestBranch.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should fail without proper permissions', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/branches/${testBranch.id}`)
        .set('Authorization', `Bearer ${limitedAdminToken}`)
        .expect(403);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer()).delete(`/api/v1/branches/${testBranch.id}`).expect(401);
    });
  });

  describe('POST /api/v1/branches/:branch_id/admins (Assign Admins)', () => {
    it('should assign admins to branch successfully', async () => {
      const adminIds = [limitedAdmin.id];

      const response = await request(app.getHttpServer())
        .post(`/api/v1/branches/${testBranch.id}/admins`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ admin_ids: adminIds })
        .expect(201);

      expect(response.body).toEqual({
        message: 'Admins assigned successfully',
      });

      // Verify assignment was created in database
      const assignment = await knex('branch_admin_assignments')
        .where('branch_id', testBranch.id)
        .andWhere('admin_id', limitedAdmin.id)
        .first();
      expect(assignment).toBeTruthy();
    });

    it('should assign multiple admins to branch', async () => {
      // Create additional admin for testing
      const additionalAdmin = await knex('admins')
        .insert({
          id: knex.raw('gen_random_uuid()'),
          first_name: 'Additional',
          last_name: 'Admin',
          phone: '+998903333333',
          login: 'additionaladmin',
          password: '$2b$10$K7L/VxwjnydKw.fK8tUqme7kk7IgJ9J9J9J9J9J9J9J9J9J9J9J9',
          branch_id: testBranch.id,
          status: 'Active',
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('*');

      const adminIds = [testAdmin.id, additionalAdmin[0].id];

      const response = await request(app.getHttpServer())
        .post(`/api/v1/branches/${secondTestBranch.id}/admins`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ admin_ids: adminIds })
        .expect(201);

      expect(response.body).toEqual({
        message: 'Admins assigned successfully',
      });

      // Verify all assignments were created
      const assignments = await knex('branch_admin_assignments').where(
        'branch_id',
        secondTestBranch.id,
      );
      expect(assignments.length).toBe(adminIds.length);
    });

    it('should fail with non-existent admin IDs', async () => {
      const adminIds = ['00000000-0000-4000-8000-000000000000'];

      await request(app.getHttpServer())
        .post(`/api/v1/branches/${testBranch.id}/admins`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ admin_ids: adminIds })
        .expect(404);
    });

    it('should fail with duplicate assignment', async () => {
      // First assignment
      await request(app.getHttpServer())
        .post(`/api/v1/branches/${testBranch.id}/admins`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ admin_ids: [testAdmin.id] })
        .expect(201);

      // Duplicate assignment
      await request(app.getHttpServer())
        .post(`/api/v1/branches/${testBranch.id}/admins`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ admin_ids: [testAdmin.id] })
        .expect(400);
    });

    it('should fail with empty admin IDs array', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/branches/${testBranch.id}/admins`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ admin_ids: [] })
        .expect(400);
    });

    it('should fail when assigning to non-existent branch', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/branches/00000000-0000-4000-8000-000000000000/admins')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ admin_ids: [testAdmin.id] })
        .expect(404);
    });

    it('should fail without proper permissions', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/branches/${testBranch.id}/admins`)
        .set('Authorization', `Bearer ${limitedAdminToken}`)
        .send({ admin_ids: [testAdmin.id] })
        .expect(403);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/branches/${testBranch.id}/admins`)
        .send({ admin_ids: [testAdmin.id] })
        .expect(401);
    });
  });

  describe('DELETE /api/v1/branches/:branch_id/admins (Remove Admins)', () => {
    beforeEach(async () => {
      // Create assignments to remove
      await knex('branch_admin_assignments').insert({
        id: knex.raw('gen_random_uuid()'),
        branch_id: testBranch.id,
        admin_id: testAdmin.id,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await knex('branch_admin_assignments').insert({
        id: knex.raw('gen_random_uuid()'),
        branch_id: testBranch.id,
        admin_id: limitedAdmin.id,
        created_at: new Date(),
        updated_at: new Date(),
      });
    });

    it('should remove admins from branch successfully', async () => {
      const adminIds = [limitedAdmin.id];

      const response = await request(app.getHttpServer())
        .delete(`/api/v1/branches/${testBranch.id}/admins`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ admin_ids: adminIds })
        .expect(200);

      expect(response.body).toEqual({
        message: 'Admins removed successfully',
      });

      // Verify assignment was removed from database
      const assignment = await knex('branch_admin_assignments')
        .where('branch_id', testBranch.id)
        .andWhere('admin_id', limitedAdmin.id)
        .first();
      expect(assignment).toBeFalsy();
    });

    it('should remove multiple admins from branch', async () => {
      const adminIds = [testAdmin.id, limitedAdmin.id];

      const response = await request(app.getHttpServer())
        .delete(`/api/v1/branches/${testBranch.id}/admins`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ admin_ids: adminIds })
        .expect(200);

      expect(response.body).toEqual({
        message: 'Admins removed successfully',
      });

      // Verify all assignments were removed
      const assignments = await knex('branch_admin_assignments')
        .where('branch_id', testBranch.id)
        .whereIn('admin_id', adminIds);
      expect(assignments.length).toBe(0);
    });

    it('should fail with non-existent assignment', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/branches/${secondTestBranch.id}/admins`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ admin_ids: [testAdmin.id] }) // No assignment exists for this branch-admin pair
        .expect(404);
    });

    it('should fail with empty admin IDs array', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/branches/${testBranch.id}/admins`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ admin_ids: [] })
        .expect(400);
    });

    it('should fail when removing from non-existent branch', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/branches/00000000-0000-4000-8000-000000000000/admins')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ admin_ids: [testAdmin.id] })
        .expect(404);
    });

    it('should fail without proper permissions', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/branches/${testBranch.id}/admins`)
        .set('Authorization', `Bearer ${limitedAdminToken}`)
        .send({ admin_ids: [testAdmin.id] })
        .expect(403);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/branches/${testBranch.id}/admins`)
        .send({ admin_ids: [testAdmin.id] })
        .expect(401);
    });
  });

  describe('Database Consistency Verification', () => {
    it('should maintain referential integrity', async () => {
      const branches = await knex('branches').select('*');
      const assignments = await knex('branch_admin_assignments').select('*');
      const admins = await knex('admins').select('*');

      for (const assignment of assignments) {
        const branch = branches.find((b) => b.id === assignment.branch_id);
        const admin = admins.find((a) => a.id === assignment.admin_id);
        expect(branch).toBeTruthy();
        expect(admin).toBeTruthy();
      }
    });

    it('should maintain audit fields correctly', async () => {
      const branches = await knex('branches').select('*');

      for (const branch of branches) {
        expect(branch.created_at).toBeTruthy();
        expect(branch.updated_at).toBeTruthy();
        expect(new Date(branch.created_at)).toBeInstanceOf(Date);
        expect(new Date(branch.updated_at)).toBeInstanceOf(Date);
      }
    });

    it('should properly handle soft deletes', async () => {
      // Soft delete a branch
      await branchesService.delete(testBranch);

      // Verify branch is soft deleted
      const deletedBranch = await knex('branches').where('id', testBranch.id).first();
      expect(deletedBranch.deleted_at).toBeTruthy();

      // Verify branch doesn't appear in active queries
      const activeBranches = await knex('branches').whereNull('deleted_at');
      expect(activeBranches.find((b) => b.id === testBranch.id)).toBeFalsy();
    });

    it('should enforce unique constraints', async () => {
      // Test name uniqueness
      try {
        await knex('branches').insert({
          id: knex.raw('gen_random_uuid()'),
          name: testBranch.name,
          address: 'Different Address',
          phone: '+998998877665',
          status: 'Open',
          sort: 999,
          created_at: new Date(),
          updated_at: new Date(),
        });
        fail('Should have thrown unique constraint error');
      } catch (error) {
        expect(error.code).toBe('23505'); // PostgreSQL unique constraint violation
      }

      // Test phone uniqueness
      try {
        await knex('branches').insert({
          id: knex.raw('gen_random_uuid()'),
          name: 'Unique Branch Name',
          address: 'Different Address',
          phone: testBranch.phone,
          status: 'Open',
          sort: 998,
          created_at: new Date(),
          updated_at: new Date(),
        });
        fail('Should have thrown unique constraint error');
      } catch (error) {
        expect(error.code).toBe('23505'); // PostgreSQL unique constraint violation
      }
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle concurrent branch creation requests', async () => {
      const promises = [];
      const branchCount = 10;

      for (let i = 0; i < branchCount; i++) {
        const promise = request(app.getHttpServer())
          .post('/api/v1/branches')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: `Concurrent Branch ${i}`,
            address: `${i} Concurrent Street`,
            phone: `+99890${4000 + i}`,
          });
        promises.push(promise);
      }

      const results = await Promise.allSettled(promises);
      const successful = results.filter((r) => r.status === 'fulfilled' && r.value.status === 201);

      expect(successful.length).toBe(branchCount);
    });

    it('should handle large paginated requests efficiently', async () => {
      const startTime = Date.now();

      await request(app.getHttpServer())
        .get('/api/v1/branches?limit=100')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle concurrent admin assignment requests', async () => {
      const promises = [];
      const assignmentCount = 5;

      // Create additional branches for concurrent assignment testing
      const branches = [];
      for (let i = 0; i < assignmentCount; i++) {
        const branch = await knex('branches')
          .insert({
            id: knex.raw('gen_random_uuid()'),
            name: `Assignment Branch ${i}`,
            address: `${i} Assignment Street`,
            phone: `+99890${5000 + i}`,
            status: 'Open',
            sort: 1000 + i,
            created_at: new Date(),
            updated_at: new Date(),
          })
          .returning('*');
        branches.push(branch[0]);
      }

      for (let i = 0; i < assignmentCount; i++) {
        const promise = request(app.getHttpServer())
          .post(`/api/v1/branches/${branches[i].id}/admins`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ admin_ids: [testAdmin.id] });
        promises.push(promise);
      }

      const results = await Promise.allSettled(promises);
      const successful = results.filter((r) => r.status === 'fulfilled' && r.value.status === 201);

      expect(successful.length).toBe(assignmentCount);
    });
  });

  afterEach(async () => {
    // Generate coverage report after each test suite
    await CoverageHelpers.generateCoverageReport();
  });
});
