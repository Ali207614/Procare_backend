import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { UsersService } from '../src/users/users.service';
import { AuthService } from '../src/auth/auth.service';
import { BranchesService } from '../src/branches/branches.service';
import { TestModuleBuilder } from './utils/test-module-builder';
import { CoverageHelpers } from './utils/coverage-helpers';

describe('Users Controller Complete E2E', () => {
  let app: INestApplication;
  let authService: AuthService;
  let usersService: UsersService;
  let branchesService: BranchesService;
  let knex: any;
  let redis: any;
  let adminToken: string;
  let testAdmin: any;
  let testBranch: any;
  let testUser: any;
  let secondTestUser: any;

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
    usersService = module.get<UsersService>(UsersService);
    branchesService = module.get<BranchesService>(BranchesService);
    knex = module.get('KNEX_CONNECTION');
    redis = module.get('REDIS_CLIENT');

    // Clean database and cache
    await knex.raw('DELETE FROM repair_orders');
    await knex.raw('DELETE FROM users');
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
    await knex.raw('DELETE FROM repair_orders');
    await knex.raw('DELETE FROM users');
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

    // Create user permissions
    const userPermissions = ['user.create', 'user.update', 'user.delete', 'user.view'];

    for (const permission of userPermissions) {
      await knex('permissions').insert({
        id: knex.raw('gen_random_uuid()'),
        name: permission,
        description: `Permission for ${permission}`,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    // Create test role with user permissions
    const testRole = await knex('roles')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        name: 'User Manager Role',
        description: 'Role for managing users',
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

    // Create test admin
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

    // Assign role to admin
    await knex('admin_roles').insert({
      id: knex.raw('gen_random_uuid()'),
      admin_id: testAdmin.id,
      role_id: role.id,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Create test users
    testUser = await knex('users')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        first_name: 'Test',
        last_name: 'User',
        phone: '+998902222222',
        email: 'testuser@example.com',
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    testUser = testUser[0];

    secondTestUser = await knex('users')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        first_name: 'Second',
        last_name: 'User',
        phone: '+998903333333',
        email: 'seconduser@example.com',
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    secondTestUser = secondTestUser[0];

    // Generate admin token
    adminToken = authService.generateJwtToken({
      id: testAdmin.id,
      login: testAdmin.login,
      first_name: testAdmin.first_name,
      last_name: testAdmin.last_name,
      phone: testAdmin.phone,
      branch_id: testAdmin.branch_id,
      status: testAdmin.status,
    });
  }

  describe('POST /api/v1/users (Create User)', () => {
    it('should create user successfully with proper permissions', async () => {
      const newUserData = {
        first_name: 'New',
        last_name: 'User',
        phone: '+998904444444',
        email: 'newuser@example.com',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newUserData)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        first_name: newUserData.first_name,
        last_name: newUserData.last_name,
        phone: newUserData.phone,
        email: newUserData.email,
        status: 'Active',
      });

      // Verify user was created in database
      const createdUser = await knex('users').where('id', response.body.id).first();
      expect(createdUser).toBeTruthy();
      expect(createdUser.phone).toBe(newUserData.phone);
      expect(createdUser.email).toBe(newUserData.email);
    });

    it('should fail with duplicate phone number', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          first_name: 'Duplicate',
          last_name: 'User',
          phone: testUser.phone, // Same phone as existing user
          email: 'duplicate@example.com',
        })
        .expect(400);
    });

    it('should fail with duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          first_name: 'Duplicate',
          last_name: 'User',
          phone: '+998905555555',
          email: testUser.email, // Same email as existing user
        })
        .expect(400);
    });

    it('should fail with invalid data validation', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          first_name: '', // Empty first name
          last_name: 'User',
          phone: 'invalid-phone', // Invalid phone format
          email: 'invalid-email', // Invalid email format
        })
        .expect(400);
    });

    it('should create user without email (optional field)', async () => {
      const userData = {
        first_name: 'No',
        last_name: 'Email',
        phone: '+998906666666',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(userData)
        .expect(201);

      expect(response.body.email).toBeNull();
    });

    it('should fail without proper permissions', async () => {
      // Remove user.create permission
      await knex('admin_role_permissions').where('admin_id', testAdmin.id).del();

      await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          first_name: 'Unauthorized',
          last_name: 'User',
          phone: '+998907777777',
          email: 'unauthorized@example.com',
        })
        .expect(403);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/users')
        .send({
          first_name: 'No',
          last_name: 'Auth',
          phone: '+998908888888',
          email: 'noauth@example.com',
        })
        .expect(401);
    });
  });

  describe('GET /api/v1/users (Get All Users)', () => {
    beforeEach(async () => {
      // Create additional test users for pagination tests
      for (let i = 1; i <= 5; i++) {
        await knex('users').insert({
          id: knex.raw('gen_random_uuid()'),
          first_name: `User${i}`,
          last_name: `Test${i}`,
          phone: `+99890${5000 + i}`,
          email: `user${i}@test.com`,
          status: i % 2 === 0 ? 'Active' : 'Inactive',
          created_at: new Date(Date.now() - i * 86400000),
          updated_at: new Date(),
        });
      }
    });

    it('should return all users with default pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/users')
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

    it('should filter users by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/users?status=Active')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toEqual(
        expect.arrayContaining([expect.objectContaining({ status: 'Active' })]),
      );

      // Ensure no inactive users are returned
      const inactiveUsers = response.body.data.filter((user) => user.status !== 'Active');
      expect(inactiveUsers).toHaveLength(0);
    });

    it('should search users by name', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/users?search=Test User')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      const foundUser = response.body.data.find(
        (user) => user.first_name === 'Test' && user.last_name === 'User',
      );
      expect(foundUser).toBeTruthy();
    });

    it('should search users by phone', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/users?search=${testUser.phone}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].phone).toBe(testUser.phone);
    });

    it('should search users by email', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/users?search=${testUser.email}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].email).toBe(testUser.email);
    });

    it('should paginate results correctly', async () => {
      const limit = 3;
      const offset = 2;

      const response = await request(app.getHttpServer())
        .get(`/api/v1/users?limit=${limit}&offset=${offset}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.meta.limit).toBe(limit);
      expect(response.body.meta.offset).toBe(offset);
      expect(response.body.data.length).toBeLessThanOrEqual(limit);
    });

    it('should sort users by creation date', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/users?sort_by=created_at&sort_order=desc')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const dates = response.body.data.map((user) => new Date(user.created_at));
      const sortedDates = [...dates].sort((a, b) => b.getTime() - a.getTime());
      expect(dates).toEqual(sortedDates);
    });

    it('should handle combined filters and pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/users?status=Active&limit=2&offset=0&sort_by=first_name&sort_order=asc')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(2);
      expect(response.body.data).toEqual(
        expect.arrayContaining([expect.objectContaining({ status: 'Active' })]),
      );
    });

    it('should return empty results for non-matching search', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/users?search=NonExistentUser')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(0);
      expect(response.body.meta.total).toBe(0);
    });

    it('should fail with invalid query parameters', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/users?limit=invalid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer()).get('/api/v1/users').expect(401);
    });
  });

  describe('PATCH /api/v1/users/:id (Update User)', () => {
    it('should update user successfully with proper permissions', async () => {
      const updateData = {
        first_name: 'Updated',
        last_name: 'Name',
        phone: '+998909999999',
        email: 'updated@example.com',
      };

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/users/${secondTestUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({
        message: 'User updated successfully',
      });

      // Verify user was updated in database
      const updatedUser = await knex('users').where('id', secondTestUser.id).first();
      expect(updatedUser.first_name).toBe(updateData.first_name);
      expect(updatedUser.last_name).toBe(updateData.last_name);
      expect(updatedUser.phone).toBe(updateData.phone);
      expect(updatedUser.email).toBe(updateData.email);
    });

    it('should update partial user data', async () => {
      const updateData = {
        first_name: 'Partially Updated',
      };

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/users/${testUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({
        message: 'User updated successfully',
      });

      // Verify only specified field was updated
      const updatedUser = await knex('users').where('id', testUser.id).first();
      expect(updatedUser.first_name).toBe(updateData.first_name);
      expect(updatedUser.last_name).toBe(testUser.last_name); // Should remain unchanged
    });

    it('should fail when updating non-existent user', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/users/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          first_name: 'Non-existent',
        })
        .expect(404);
    });

    it('should fail with duplicate phone number', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/users/${secondTestUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          phone: testUser.phone, // Trying to use existing phone
        })
        .expect(400);
    });

    it('should fail with duplicate email', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/users/${secondTestUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: testUser.email, // Trying to use existing email
        })
        .expect(400);
    });

    it('should fail with invalid UUID format', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/users/invalid-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          first_name: 'Invalid',
        })
        .expect(400);
    });

    it('should fail without proper permissions', async () => {
      // Remove user.update permission
      await knex('admin_role_permissions').where('admin_id', testAdmin.id).del();

      await request(app.getHttpServer())
        .patch(`/api/v1/users/${testUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          first_name: 'Unauthorized Update',
        })
        .expect(403);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/users/${testUser.id}`)
        .send({
          first_name: 'No Auth',
        })
        .expect(401);
    });
  });

  describe('DELETE /api/v1/users/:id (Delete User)', () => {
    it('should delete user successfully with proper permissions', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/v1/users/${secondTestUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toEqual({
        message: 'User deleted successfully',
      });

      // Verify user was soft deleted in database
      const deletedUser = await knex('users').where('id', secondTestUser.id).first();
      expect(deletedUser.deleted_at).toBeTruthy();
    });

    it('should fail when deleting non-existent user', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/users/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should fail when trying to delete already deleted user', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/users/${secondTestUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should fail with invalid UUID format', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/users/invalid-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should fail without proper permissions', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/users/${testUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer()).delete(`/api/v1/users/${testUser.id}`).expect(401);
    });
  });

  describe('GET /api/v1/users/:id (Get User with Orders)', () => {
    beforeEach(async () => {
      // Create test repair orders for the user
      for (let i = 1; i <= 3; i++) {
        await knex('repair_orders').insert({
          id: knex.raw('gen_random_uuid()'),
          user_id: testUser.id,
          branch_id: testBranch.id,
          device_type: `Device ${i}`,
          device_model: `Model ${i}`,
          device_serial: `Serial${i}`,
          problem_description: `Problem ${i}`,
          status: i % 2 === 0 ? 'Open' : 'In Progress',
          total_cost: i * 100,
          created_at: new Date(Date.now() - i * 86400000),
          updated_at: new Date(),
          created_by: testAdmin.id,
        });
      }
    });

    it('should return user with repair orders successfully', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/users/${testUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: testUser.id,
        first_name: testUser.first_name,
        last_name: testUser.last_name,
        phone: testUser.phone,
        email: testUser.email,
        status: testUser.status,
        repair_orders: expect.any(Array),
      });

      expect(response.body.repair_orders.length).toBe(3);
      expect(response.body.repair_orders[0]).toMatchObject({
        id: expect.any(String),
        device_type: expect.any(String),
        device_model: expect.any(String),
        problem_description: expect.any(String),
        status: expect.any(String),
        total_cost: expect.any(Number),
      });
    });

    it('should return user without repair orders if none exist', async () => {
      // Delete repair orders for secondTestUser
      await knex('repair_orders').where('user_id', secondTestUser.id).del();

      const response = await request(app.getHttpServer())
        .get(`/api/v1/users/${secondTestUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.repair_orders).toHaveLength(0);
    });

    it('should fail when getting non-existent user', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/users/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should fail with invalid UUID format', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/users/invalid-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should not return soft-deleted users', async () => {
      // Soft delete the user
      await knex('users').where('id', testUser.id).update({ deleted_at: new Date() });

      await request(app.getHttpServer())
        .get(`/api/v1/users/${testUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should include repair order details correctly', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/users/${testUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const repairOrder = response.body.repair_orders[0];
      expect(repairOrder).toHaveProperty('id');
      expect(repairOrder).toHaveProperty('device_type');
      expect(repairOrder).toHaveProperty('device_model');
      expect(repairOrder).toHaveProperty('device_serial');
      expect(repairOrder).toHaveProperty('problem_description');
      expect(repairOrder).toHaveProperty('status');
      expect(repairOrder).toHaveProperty('total_cost');
      expect(repairOrder).toHaveProperty('created_at');
      expect(repairOrder).toHaveProperty('updated_at');
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer()).get(`/api/v1/users/${testUser.id}`).expect(401);
    });
  });

  describe('Database Consistency Verification', () => {
    it('should maintain referential integrity', async () => {
      const users = await knex('users').select('*');
      const repairOrders = await knex('repair_orders').select('*');

      for (const order of repairOrders) {
        if (order.user_id) {
          const user = users.find((u) => u.id === order.user_id);
          expect(user).toBeTruthy();
        }
      }
    });

    it('should maintain audit fields correctly', async () => {
      const users = await knex('users').select('*');

      for (const user of users) {
        expect(user.created_at).toBeTruthy();
        expect(user.updated_at).toBeTruthy();
        expect(new Date(user.created_at)).toBeInstanceOf(Date);
        expect(new Date(user.updated_at)).toBeInstanceOf(Date);
      }
    });

    it('should properly handle soft deletes', async () => {
      // Soft delete a user
      await usersService.delete(testUser.id);

      // Verify user is soft deleted
      const deletedUser = await knex('users').where('id', testUser.id).first();
      expect(deletedUser.deleted_at).toBeTruthy();

      // Verify user doesn't appear in active queries
      const activeUsers = await knex('users').whereNull('deleted_at');
      expect(activeUsers.find((u) => u.id === testUser.id)).toBeFalsy();
    });

    it('should enforce unique constraints', async () => {
      // Test phone uniqueness
      try {
        await knex('users').insert({
          id: knex.raw('gen_random_uuid()'),
          first_name: 'Duplicate',
          last_name: 'Phone',
          phone: testUser.phone,
          email: 'unique@example.com',
          status: 'Active',
          created_at: new Date(),
          updated_at: new Date(),
        });
        fail('Should have thrown unique constraint error');
      } catch (error) {
        expect(error.code).toBe('23505'); // PostgreSQL unique constraint violation
      }

      // Test email uniqueness
      try {
        await knex('users').insert({
          id: knex.raw('gen_random_uuid()'),
          first_name: 'Duplicate',
          last_name: 'Email',
          phone: '+998999999999',
          email: testUser.email,
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
      const endpoints = [
        { method: 'post', path: '/api/v1/users' },
        { method: 'patch', path: `/api/v1/users/${testUser.id}` },
        { method: 'delete', path: `/api/v1/users/${testUser.id}` },
        { method: 'get', path: '/api/v1/users' },
        { method: 'get', path: `/api/v1/users/${testUser.id}` },
      ];

      for (const endpoint of endpoints) {
        await request(app.getHttpServer())[endpoint.method](endpoint.path).expect(401);
      }
    });

    it('should validate JWT token format', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .expect(401);
    });

    it('should validate admin permissions for protected operations', async () => {
      // Remove all permissions from admin
      await knex('admin_role_permissions').where('admin_id', testAdmin.id).del();

      const protectedEndpoints = [
        { method: 'post', path: '/api/v1/users', data: {} },
        { method: 'patch', path: `/api/v1/users/${testUser.id}`, data: {} },
        { method: 'delete', path: `/api/v1/users/${testUser.id}` },
      ];

      for (const endpoint of protectedEndpoints) {
        const req = request(app.getHttpServer())
          [endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${adminToken}`);

        if (endpoint.data) {
          req.send(endpoint.data);
        }

        await req.expect(403);
      }
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle concurrent user creation requests', async () => {
      const promises = [];
      const userCount = 10;

      for (let i = 0; i < userCount; i++) {
        const promise = request(app.getHttpServer())
          .post('/api/v1/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            first_name: `Concurrent${i}`,
            last_name: `User${i}`,
            phone: `+99890${2000 + i}`,
            email: `concurrent${i}@example.com`,
          });
        promises.push(promise);
      }

      const results = await Promise.allSettled(promises);
      const successful = results.filter((r) => r.status === 'fulfilled' && r.value.status === 201);

      expect(successful.length).toBe(userCount);
    });

    it('should handle large paginated requests efficiently', async () => {
      const startTime = Date.now();

      await request(app.getHttpServer())
        .get('/api/v1/users?limit=100')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle complex search queries efficiently', async () => {
      const startTime = Date.now();

      await request(app.getHttpServer())
        .get('/api/v1/users?search=test&status=Active&limit=50')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(3000); // Should complete within 3 seconds
    });
  });

  afterEach(async () => {
    // Generate coverage report after each test suite
    await CoverageHelpers.generateCoverageReport();
  });
});
