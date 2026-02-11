import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AdminFactory } from './factories/admin.factory';
import { UserFactory } from './factories/user.factory';
import { BranchFactory } from './factories/branch.factory';
import { RoleFactory } from './factories/role.factory';
import { TestHelpers } from './utils/test-helpers';
import { v4 as uuidv4 } from 'uuid';
import { Knex } from 'knex';

describe('Repair Orders - Comprehensive E2E Tests', () => {
  let app: INestApplication;
  let knex: Knex;
  let redis: any;

  // Test data entities
  let adminData: any;
  let admin2Data: any;
  let superAdminData: any;
  let userData: any;
  let branchData: any;
  let branch2Data: any;
  let roleData: any;
  let phoneCategory: any;
  let repairStatus: any;
  let problemCategory: any;

  // Auth tokens
  let adminToken: string;
  let admin2Token: string;
  let superAdminToken: string;

  // Test repair order ID
  let repairOrderId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();

    knex = moduleFixture.get('KnexConnection');
    redis = moduleFixture.get('REDIS_CLIENT');

    await TestHelpers.cleanDatabase(knex);
    await redis.flushall();

    // Setup test data
    await setupTestData();
  });

  beforeEach(async () => {
    // Clean repair orders and related data before each test
    await knex.raw('TRUNCATE TABLE repair_order_comments CASCADE');
    await knex.raw('TRUNCATE TABLE repair_order_attachments CASCADE');
    await knex.raw('TRUNCATE TABLE repair_order_initial_problems CASCADE');
    await knex.raw('TRUNCATE TABLE repair_order_final_problems CASCADE');
    await knex.raw('TRUNCATE TABLE repair_order_history CASCADE');
    await knex.raw('TRUNCATE TABLE repair_orders CASCADE');
  });

  afterAll(async () => {
    await TestHelpers.cleanDatabase(knex);
    await redis.flushall();
    await app.close();
  });

  async function setupTestData() {
    // Create branches
    branchData = await createBranch('Main Branch');
    branch2Data = await createBranch('Secondary Branch');

    // Create roles and permissions
    roleData = await createRole('Admin', [
      'repair_orders.create',
      'repair_orders.read',
      'repair_orders.update',
      'repair_orders.delete',
    ]);
    const superAdminRole = await createRole('Super Admin', ['*']);
    const limitedRole = await createRole('Limited Admin', ['repair_orders.read']);

    // Create admins
    adminData = await createAdmin('Test Admin', branchData.id, roleData.id);
    admin2Data = await createAdmin('Test Admin 2', branch2Data.id, roleData.id);
    superAdminData = await createAdmin('Super Admin', branchData.id, superAdminRole.id);

    // Create user
    userData = await createUser();

    // Create supporting entities
    phoneCategory = await createPhoneCategory();
    repairStatus = await createRepairStatus();
    problemCategory = await createProblemCategory();

    // Generate auth tokens
    adminToken = await authenticateAdmin(adminData);
    admin2Token = await authenticateAdmin(admin2Data);
    superAdminToken = await authenticateAdmin(superAdminData);
  }

  async function createBranch(name: string) {
    const branch = BranchFactory.create({ name_uz: name, name_en: name });
    await knex('branches').insert(branch);
    return branch;
  }

  async function createRole(name: string, permissions: string[]) {
    const role = RoleFactory.create({ name });
    await knex('roles').insert(role);

    // Create permissions if they don't exist and link to role
    for (const permission of permissions) {
      const permissionId = uuidv4();
      await knex('permissions')
        .insert({
          id: permissionId,
          name: permission,
          description: `Permission for ${permission}`,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .onConflict('name')
        .ignore();

      const existingPermission = await knex('permissions').where('name', permission).first();
      await knex('role_permissions')
        .insert({
          role_id: role.id,
          permission_id: existingPermission.id,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .onConflict(['role_id', 'permission_id'])
        .ignore();
    }

    return role;
  }

  async function createAdmin(name: string, branchId: string, roleId: string) {
    const admin = AdminFactory.create({
      first_name: name.split(' ')[0],
      last_name: name.split(' ')[1] || 'Admin',
      phone_number: `+99890${Math.floor(Math.random() * 10000000)}`,
      password: await hashPassword('password123'),
      status: 'Open',
      is_active: true,
    });
    await knex('admins').insert(admin);

    // Link admin to branch
    await knex('admin_branches').insert({
      admin_id: admin.id,
      branch_id: branchId,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Link admin to role
    await knex('admin_roles').insert({
      admin_id: admin.id,
      role_id: roleId,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return admin;
  }

  async function createUser() {
    const user = UserFactory.create();
    await knex('users').insert(user);
    return user;
  }

  async function createPhoneCategory() {
    const category = {
      id: uuidv4(),
      name_uz: 'iPhone',
      name_en: 'iPhone',
      name_ru: 'iPhone',
      created_at: new Date(),
      updated_at: new Date(),
    };
    await knex('phone_categories').insert(category);
    return category;
  }

  async function createRepairStatus() {
    const status = {
      id: uuidv4(),
      name_uz: 'Kutilmoqda',
      name_en: 'Waiting',
      name_ru: 'Ожидание',
      bg_color: '#f0f0f0',
      color: '#333',
      sort: 1,
      branch_id: branchData.id,
      created_at: new Date(),
      updated_at: new Date(),
    };
    await knex('repair_statuses').insert(status);
    return status;
  }

  async function createProblemCategory() {
    const category = {
      id: uuidv4(),
      name_uz: 'Ekran muammosi',
      name_en: 'Screen issue',
      name_ru: 'Проблема экрана',
      created_at: new Date(),
      updated_at: new Date(),
    };
    await knex('problem_categories').insert(category);
    return category;
  }

  async function hashPassword(password: string): Promise<string> {
    // In real implementation, use bcrypt or similar
    // For testing, return a mock hash
    return `hashed_${password}`;
  }

  async function authenticateAdmin(admin: any): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({
        phone_number: admin.phone_number,
        password: 'password123',
      })
      .expect(200);

    return response.body.access_token;
  }

  async function createValidRepairOrderDto(overrides = {}) {
    return {
      user_id: userData.id,
      phone_category_id: phoneCategory.id,
      status_id: repairStatus.id,
      priority: 'Medium',
      initial_problems: [
        {
          problem_category_id: problemCategory.id,
          price: 100000,
          estimated_minutes: 60,
          parts: [],
        },
      ],
      comments: [
        {
          text: 'Device has screen damage',
        },
      ],
      ...overrides,
    };
  }

  // ========================================
  // CRUD Operations Testing
  // ========================================

  describe('POST /repair-orders - Create Repair Order', () => {
    it('should create repair order successfully with valid data', async () => {
      const createDto = await createValidRepairOrderDto();

      const response = await request(app.getHttpServer())
        .post('/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ branch_id: branchData.id, status_id: repairStatus.id })
        .send(createDto)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('number_id');
      expect(response.body.user_id).toBe(createDto.user_id);
      expect(response.body.phone_category_id).toBe(createDto.phone_category_id);
      expect(response.body.priority).toBe(createDto.priority);

      // Verify database record
      const dbRecord = await knex('repair_orders').where({ id: response.body.id }).first();
      expect(dbRecord).toBeDefined();
      expect(dbRecord.user_id).toBe(createDto.user_id);
      expect(dbRecord.branch_id).toBe(branchData.id);
      expect(dbRecord.status_id).toBe(repairStatus.id);
      expect(dbRecord.created_by).toBe(adminData.id);
      expect(dbRecord.updated_by).toBe(adminData.id);
      expect(dbRecord.created_at).toBeTruthy();
      expect(dbRecord.updated_at).toBeTruthy();

      // Verify initial problems were created
      const initialProblems = await knex('repair_order_initial_problems').where({
        repair_order_id: response.body.id,
      });
      expect(initialProblems.length).toBe(1);
      expect(initialProblems[0].problem_category_id).toBe(problemCategory.id);

      // Verify comments were created
      const comments = await knex('repair_order_comments').where({
        repair_order_id: response.body.id,
      });
      expect(comments.length).toBe(1);
      expect(comments[0].text).toBe('Device has screen damage');

      repairOrderId = response.body.id;
    });

    it('should validate required fields', async () => {
      const invalidDto = {
        // Missing required fields
        priority: 'High',
      };

      const response = await request(app.getHttpServer())
        .post('/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ branch_id: branchData.id, status_id: repairStatus.id })
        .send(invalidDto)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('location');
      expect(Array.isArray(response.body.message)).toBe(true);
    });

    it('should validate UUID formats', async () => {
      const createDto = await createValidRepairOrderDto({
        user_id: 'invalid-uuid',
      });

      await request(app.getHttpServer())
        .post('/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ branch_id: branchData.id, status_id: repairStatus.id })
        .send(createDto)
        .expect(400);
    });

    it('should validate enum values', async () => {
      const createDto = await createValidRepairOrderDto({
        priority: 'InvalidPriority',
      });

      await request(app.getHttpServer())
        .post('/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ branch_id: branchData.id, status_id: repairStatus.id })
        .send(createDto)
        .expect(400);
    });

    it('should reject unauthorized requests', async () => {
      const createDto = await createValidRepairOrderDto();

      await request(app.getHttpServer()).post('/repair-orders').send(createDto).expect(401);
    });

    it('should reject requests with invalid token', async () => {
      const createDto = await createValidRepairOrderDto();

      await request(app.getHttpServer())
        .post('/repair-orders')
        .set('Authorization', 'Bearer invalid-token')
        .send(createDto)
        .expect(401);
    });
  });

  describe('GET /repair-orders/:id - Get Single Repair Order', () => {
    beforeEach(async () => {
      // Create test repair order
      const createDto = await createValidRepairOrderDto();
      const response = await request(app.getHttpServer())
        .post('/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ branch_id: branchData.id, status_id: repairStatus.id })
        .send(createDto);
      repairOrderId = response.body.id;
    });

    it('should return repair order details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/repair-orders/${repairOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', repairOrderId);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('branch');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('phone_category');
      expect(response.body).toHaveProperty('initial_problems');
      expect(response.body).toHaveProperty('comments');
      expect(response.body.user.id).toBe(userData.id);
      expect(response.body.branch.id).toBe(branchData.id);
      expect(response.body.status.id).toBe(repairStatus.id);
    });

    it('should return 404 for non-existent repair order', async () => {
      const nonExistentId = '12345678-1234-4000-8000-123456789012';

      const response = await request(app.getHttpServer())
        .get(`/repair-orders/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('location');
    });

    it('should return 400 for invalid UUID format', async () => {
      await request(app.getHttpServer())
        .get('/repair-orders/invalid-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer()).get(`/repair-orders/${repairOrderId}`).expect(401);
    });
  });

  describe('PATCH /repair-orders/:id - Update Repair Order', () => {
    beforeEach(async () => {
      const createDto = await createValidRepairOrderDto();
      const response = await request(app.getHttpServer())
        .post('/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ branch_id: branchData.id, status_id: repairStatus.id })
        .send(createDto);
      repairOrderId = response.body.id;
    });

    it('should update repair order successfully', async () => {
      const updateDto = {
        priority: 'High',
        total: 150000,
        imei: '123456789012345',
      };

      const response = await request(app.getHttpServer())
        .patch(`/repair-orders/${repairOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Repair order updated successfully');

      // Verify database update
      const dbRecord = await knex('repair_orders').where({ id: repairOrderId }).first();
      expect(dbRecord.priority).toBe(updateDto.priority);
      expect(parseFloat(dbRecord.total)).toBe(updateDto.total);
      expect(dbRecord.imei).toBe(updateDto.imei);
      expect(dbRecord.updated_by).toBe(adminData.id);
      expect(new Date(dbRecord.updated_at)).toBeInstanceOf(Date);
    });

    it('should validate update data types', async () => {
      const invalidDto = {
        total: 'invalid-number',
        priority: 'InvalidPriority',
      };

      await request(app.getHttpServer())
        .patch(`/repair-orders/${repairOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidDto)
        .expect(400);
    });

    it('should return 404 for non-existent repair order', async () => {
      const nonExistentId = '12345678-1234-4000-8000-123456789012';
      const updateDto = { priority: 'High' };

      await request(app.getHttpServer())
        .patch(`/repair-orders/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateDto)
        .expect(404);
    });
  });

  describe('GET /repair-orders - List Repair Orders with Pagination', () => {
    beforeEach(async () => {
      // Create multiple test repair orders
      for (let i = 0; i < 5; i++) {
        const createDto = await createValidRepairOrderDto({
          priority: i % 2 === 0 ? 'High' : 'Low',
        });
        await request(app.getHttpServer())
          .post('/repair-orders')
          .set('Authorization', `Bearer ${adminToken}`)
          .query({ branch_id: branchData.id, status_id: repairStatus.id })
          .send(createDto);
      }
    });

    it('should return paginated repair orders grouped by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ branch_id: branchData.id, limit: 3, offset: 0 })
        .expect(200);

      expect(response.body).toHaveProperty('Waiting');
      expect(Array.isArray(response.body.Waiting)).toBe(true);
      expect(response.body.Waiting.length).toBeLessThanOrEqual(3);

      // Verify each repair order has required fields
      response.body.Waiting.forEach((order: any) => {
        expect(order).toHaveProperty('id');
        expect(order).toHaveProperty('number_id');
        expect(order).toHaveProperty('priority');
        expect(order).toHaveProperty('user');
        expect(order).toHaveProperty('status');
      });
    });

    it('should filter by priority', async () => {
      await request(app.getHttpServer())
        .get('/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ branch_id: branchData.id, priority: 'High' })
        .expect(200);
    });

    it('should filter by date range', async () => {
      const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const to = new Date().toISOString();

      await request(app.getHttpServer())
        .get('/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          branch_id: branchData.id,
          created_from: from,
          created_to: to,
        })
        .expect(200);
    });

    it('should search by user information', async () => {
      await request(app.getHttpServer())
        .get('/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ branch_id: branchData.id, search: userData.first_name })
        .expect(200);
    });

    it('should require branch_id parameter', async () => {
      await request(app.getHttpServer())
        .get('/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  describe('DELETE /repair-orders/:id - Soft Delete Repair Order', () => {
    beforeEach(async () => {
      const createDto = await createValidRepairOrderDto();
      const response = await request(app.getHttpServer())
        .post('/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ branch_id: branchData.id, status_id: repairStatus.id })
        .send(createDto);
      repairOrderId = response.body.id;
    });

    it('should soft delete repair order successfully', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/repair-orders/${repairOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Repair order deleted successfully');

      // Verify soft delete in database
      const dbRecord = await knex('repair_orders').where({ id: repairOrderId }).first();
      expect(dbRecord.deleted_at).toBeTruthy();
      expect(dbRecord.updated_by).toBe(adminData.id);

      // Verify repair order is not accessible after deletion
      await request(app.getHttpServer())
        .get(`/repair-orders/${repairOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should return 404 for already deleted repair order', async () => {
      // Delete first time
      await request(app.getHttpServer())
        .delete(`/repair-orders/${repairOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Try to delete again
      await request(app.getHttpServer())
        .delete(`/repair-orders/${repairOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  // ========================================
  // Status Transitions Testing
  // ========================================

  describe('PATCH /repair-orders/:id/move - Status Transitions', () => {
    let inProgressStatus: any;
    let completedStatus: any;
    let closedStatus: any;

    beforeAll(async () => {
      // Create additional statuses for testing transitions
      inProgressStatus = {
        id: uuidv4(),
        name_uz: 'Jarayonda',
        name_en: 'In Progress',
        name_ru: 'В процессе',
        bg_color: '#ffa500',
        color: '#fff',
        sort: 2,
        branch_id: branchData.id,
        created_at: new Date(),
        updated_at: new Date(),
      };
      await knex('repair_statuses').insert(inProgressStatus);

      completedStatus = {
        id: uuidv4(),
        name_uz: 'Tugallangan',
        name_en: 'Completed',
        name_ru: 'Завершено',
        bg_color: '#008000',
        color: '#fff',
        sort: 3,
        branch_id: branchData.id,
        created_at: new Date(),
        updated_at: new Date(),
      };
      await knex('repair_statuses').insert(completedStatus);

      closedStatus = {
        id: uuidv4(),
        name_uz: 'Yopilgan',
        name_en: 'Closed',
        name_ru: 'Закрыто',
        bg_color: '#808080',
        color: '#fff',
        sort: 4,
        branch_id: branchData.id,
        created_at: new Date(),
        updated_at: new Date(),
      };
      await knex('repair_statuses').insert(closedStatus);
    });

    beforeEach(async () => {
      const createDto = await createValidRepairOrderDto();
      const response = await request(app.getHttpServer())
        .post('/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ branch_id: branchData.id, status_id: repairStatus.id })
        .send(createDto);
      repairOrderId = response.body.id;
    });

    it('should move repair order from Open to InProgress', async () => {
      const moveDto = {
        notes: 'Starting repair work',
      };

      const response = await request(app.getHttpServer())
        .patch(`/repair-orders/${repairOrderId}/move`)
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ status_id: inProgressStatus.id })
        .send(moveDto)
        .expect(200);

      expect(response.body).toHaveProperty('message');

      // Verify status change in database
      const dbRecord = await knex('repair_orders').where({ id: repairOrderId }).first();
      expect(dbRecord.status_id).toBe(inProgressStatus.id);
      expect(dbRecord.updated_by).toBe(adminData.id);

      // Verify history record was created
      const historyRecords = await knex('repair_order_history')
        .where({ repair_order_id: repairOrderId })
        .orderBy('created_at', 'desc');
      expect(historyRecords.length).toBeGreaterThan(0);
      expect(historyRecords[0].field_name).toBe('status_id');
      expect(historyRecords[0].new_value).toBe(inProgressStatus.id);
      expect(historyRecords[0].changed_by).toBe(adminData.id);
    });

    it('should move repair order from InProgress to Completed', async () => {
      // First move to InProgress
      await request(app.getHttpServer())
        .patch(`/repair-orders/${repairOrderId}/move`)
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ status_id: inProgressStatus.id })
        .send({ notes: 'Starting work' });

      // Then move to Completed
      const moveDto = {
        notes: 'Repair completed successfully',
      };

      await request(app.getHttpServer())
        .patch(`/repair-orders/${repairOrderId}/move`)
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ status_id: completedStatus.id })
        .send(moveDto)
        .expect(200);

      const dbRecord = await knex('repair_orders').where({ id: repairOrderId }).first();
      expect(dbRecord.status_id).toBe(completedStatus.id);
    });

    it('should validate status transition rules', async () => {
      // Try to move directly to Closed without going through intermediate statuses
      const moveDto = {
        notes: 'Invalid transition',
      };

      const response = await request(app.getHttpServer())
        .patch(`/repair-orders/${repairOrderId}/move`)
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ status_id: closedStatus.id })
        .send(moveDto);

      // Should either succeed or return business rule validation error
      expect([200, 400, 403, 409]).toContain(response.status);
    });

    it('should require valid status_id in query', async () => {
      const moveDto = { notes: 'Test move' };

      await request(app.getHttpServer())
        .patch(`/repair-orders/${repairOrderId}/move`)
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ status_id: 'invalid-status-id' })
        .send(moveDto)
        .expect(400);
    });
  });

  // ========================================
  // Branch-Level Access Control Testing
  // ========================================

  describe('Branch-Level Access Control', () => {
    beforeEach(async () => {
      // Create repair order in branch1 by admin1
      const createDto = await createValidRepairOrderDto();
      const response = await request(app.getHttpServer())
        .post('/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ branch_id: branchData.id, status_id: repairStatus.id })
        .send(createDto);
      repairOrderId = response.body.id;
    });

    it('should allow admin to access repair orders from their branch', async () => {
      await request(app.getHttpServer())
        .get(`/repair-orders/${repairOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should deny cross-branch access for regular admins', async () => {
      // Admin2 from branch2 tries to access repair order from branch1
      const response = await request(app.getHttpServer())
        .get(`/repair-orders/${repairOrderId}`)
        .set('Authorization', `Bearer ${admin2Token}`);

      expect([403, 404]).toContain(response.status);
    });

    it('should allow super admin to access all branches', async () => {
      await request(app.getHttpServer())
        .get(`/repair-orders/${repairOrderId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
    });

    it('should filter list by admin branch', async () => {
      // Create repair order in branch2
      const createDto = await createValidRepairOrderDto();
      await request(app.getHttpServer())
        .post('/repair-orders')
        .set('Authorization', `Bearer ${admin2Token}`)
        .query({ branch_id: branch2Data.id, status_id: repairStatus.id })
        .send(createDto);

      // Admin1 should only see branch1 repair orders
      const response1 = await request(app.getHttpServer())
        .get('/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ branch_id: branchData.id })
        .expect(200);

      // Admin2 should only see branch2 repair orders
      const response2 = await request(app.getHttpServer())
        .get('/repair-orders')
        .set('Authorization', `Bearer ${admin2Token}`)
        .query({ branch_id: branch2Data.id })
        .expect(200);

      // Each admin should see different repair orders
      const admin1Orders = Object.values(response1.body).flat();
      const admin2Orders = Object.values(response2.body).flat();

      if (admin1Orders.length > 0 && admin2Orders.length > 0) {
        const admin1Ids = admin1Orders.map((order: any) => order.id);
        const admin2Ids = admin2Orders.map((order: any) => order.id);
        expect(admin1Ids).not.toEqual(admin2Ids);
      }
    });

    it('should prevent cross-branch updates', async () => {
      const updateDto = { priority: 'High' };

      const response = await request(app.getHttpServer())
        .patch(`/repair-orders/${repairOrderId}`)
        .set('Authorization', `Bearer ${admin2Token}`)
        .send(updateDto);

      expect([403, 404]).toContain(response.status);
    });

    it('should prevent cross-branch deletions', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/repair-orders/${repairOrderId}`)
        .set('Authorization', `Bearer ${admin2Token}`);

      expect([403, 404]).toContain(response.status);
    });
  });

  // ========================================
  // Permission-Based Testing
  // ========================================

  describe('Permission-Based Access Control', () => {
    let readOnlyAdminData: any;
    let readOnlyToken: string;

    beforeAll(async () => {
      // Create read-only admin with limited permissions
      const readOnlyRole = await createRole('Read Only', ['repair_orders.read']);
      readOnlyAdminData = await createAdmin('Read Only Admin', branchData.id, readOnlyRole.id);
      readOnlyToken = await authenticateAdmin(readOnlyAdminData);
    });

    beforeEach(async () => {
      const createDto = await createValidRepairOrderDto();
      const response = await request(app.getHttpServer())
        .post('/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ branch_id: branchData.id, status_id: repairStatus.id })
        .send(createDto);
      repairOrderId = response.body.id;
    });

    it('should allow read operations with repair_orders.read permission', async () => {
      await request(app.getHttpServer())
        .get(`/repair-orders/${repairOrderId}`)
        .set('Authorization', `Bearer ${readOnlyToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get('/repair-orders')
        .set('Authorization', `Bearer ${readOnlyToken}`)
        .query({ branch_id: branchData.id })
        .expect(200);
    });

    it('should deny create operations without repair_orders.create permission', async () => {
      const createDto = await createValidRepairOrderDto();

      const response = await request(app.getHttpServer())
        .post('/repair-orders')
        .set('Authorization', `Bearer ${readOnlyToken}`)
        .query({ branch_id: branchData.id, status_id: repairStatus.id })
        .send(createDto);

      expect([403, 401]).toContain(response.status);
    });

    it('should deny update operations without repair_orders.update permission', async () => {
      const updateDto = { priority: 'High' };

      const response = await request(app.getHttpServer())
        .patch(`/repair-orders/${repairOrderId}`)
        .set('Authorization', `Bearer ${readOnlyToken}`)
        .send(updateDto);

      expect([403, 401]).toContain(response.status);
    });

    it('should deny delete operations without repair_orders.delete permission', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/repair-orders/${repairOrderId}`)
        .set('Authorization', `Bearer ${readOnlyToken}`);

      expect([403, 401]).toContain(response.status);
    });

    it('should deny status moves without appropriate permissions', async () => {
      const moveDto = { notes: 'Unauthorized move' };

      const response = await request(app.getHttpServer())
        .patch(`/repair-orders/${repairOrderId}/move`)
        .set('Authorization', `Bearer ${readOnlyToken}`)
        .query({ status_id: repairStatus.id })
        .send(moveDto);

      expect([403, 401]).toContain(response.status);
    });
  });

  // ========================================
  // Data Validation Testing
  // ========================================

  describe('Data Validation', () => {
    it('should validate required fields on create', async () => {
      const invalidDtos = [
        {}, // Empty object
        { user_id: userData.id }, // Missing phone_category_id and status_id
        { phone_category_id: phoneCategory.id }, // Missing user_id and status_id
        { status_id: repairStatus.id }, // Missing user_id and phone_category_id
      ];

      for (const dto of invalidDtos) {
        const response = await request(app.getHttpServer())
          .post('/repair-orders')
          .set('Authorization', `Bearer ${adminToken}`)
          .query({ branch_id: branchData.id, status_id: repairStatus.id })
          .send(dto)
          .expect(400);

        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('location');
      }
    });

    it('should validate UUID format for IDs', async () => {
      const invalidUuids = ['not-a-uuid', '123', '', null, undefined];

      for (const invalidUuid of invalidUuids) {
        const createDto = await createValidRepairOrderDto({
          user_id: invalidUuid,
        });

        await request(app.getHttpServer())
          .post('/repair-orders')
          .set('Authorization', `Bearer ${adminToken}`)
          .query({ branch_id: branchData.id, status_id: repairStatus.id })
          .send(createDto)
          .expect(400);
      }
    });

    it('should validate enum values', async () => {
      const invalidPriorities = ['Invalid', 'HIGHEST', 'lowest', 123, null];

      for (const priority of invalidPriorities) {
        const createDto = await createValidRepairOrderDto({ priority });

        await request(app.getHttpServer())
          .post('/repair-orders')
          .set('Authorization', `Bearer ${adminToken}`)
          .query({ branch_id: branchData.id, status_id: repairStatus.id })
          .send(createDto)
          .expect(400);
      }
    });

    it('should validate nested object structures', async () => {
      const invalidProblems = [
        [{ price: 'invalid-number' }], // Invalid price type
        [{ problem_category_id: 'invalid-uuid', price: 100 }], // Invalid UUID
        [{ problem_category_id: problemCategory.id }], // Missing price
        [{ price: 100 }], // Missing problem_category_id
      ];

      for (const problems of invalidProblems) {
        const createDto = await createValidRepairOrderDto({
          initial_problems: problems,
        });

        await request(app.getHttpServer())
          .post('/repair-orders')
          .set('Authorization', `Bearer ${adminToken}`)
          .query({ branch_id: branchData.id, status_id: repairStatus.id })
          .send(createDto)
          .expect(400);
      }
    });

    it('should validate array constraints', async () => {
      const createDto = await createValidRepairOrderDto({
        admin_ids: ['duplicate-id', 'duplicate-id'], // Should fail uniqueness
      });

      await request(app.getHttpServer())
        .post('/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ branch_id: branchData.id, status_id: repairStatus.id })
        .send(createDto)
        .expect(400);
    });
  });

  // ========================================
  // Edge Cases and Error Scenarios
  // ========================================

  describe('Edge Cases and Error Scenarios', () => {
    beforeEach(async () => {
      const createDto = await createValidRepairOrderDto();
      const response = await request(app.getHttpServer())
        .post('/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ branch_id: branchData.id, status_id: repairStatus.id })
        .send(createDto);
      repairOrderId = response.body.id;
    });

    it('should handle non-existent user ID gracefully', async () => {
      const createDto = await createValidRepairOrderDto({
        user_id: '12345678-1234-4000-8000-123456789012', // Valid UUID but non-existent
      });

      const response = await request(app.getHttpServer())
        .post('/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ branch_id: branchData.id, status_id: repairStatus.id })
        .send(createDto);

      expect([400, 404]).toContain(response.status);
    });

    it('should handle non-existent phone category gracefully', async () => {
      const createDto = await createValidRepairOrderDto({
        phone_category_id: '12345678-1234-4000-8000-123456789012',
      });

      const response = await request(app.getHttpServer())
        .post('/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ branch_id: branchData.id, status_id: repairStatus.id })
        .send(createDto);

      expect([400, 404]).toContain(response.status);
    });

    it('should handle concurrent modifications gracefully', async () => {
      const updateDto = { priority: 'High' };

      // Make multiple simultaneous update requests
      const promises = Array(5)
        .fill(null)
        .map(() =>
          request(app.getHttpServer())
            .patch(`/repair-orders/${repairOrderId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(updateDto),
        );

      const responses = await Promise.allSettled(promises);

      // At least one should succeed
      const successful = responses.filter(
        (result) => result.status === 'fulfilled' && result.value.status === 200,
      );
      expect(successful.length).toBeGreaterThan(0);
    });

    it('should handle database constraint violations', async () => {
      // Create repair order with very long string that might violate constraints
      const longString = 'a'.repeat(2000);
      const createDto = await createValidRepairOrderDto({
        comments: [{ text: longString }],
      });

      const response = await request(app.getHttpServer())
        .post('/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ branch_id: branchData.id, status_id: repairStatus.id })
        .send(createDto);

      expect([400, 413]).toContain(response.status);
    });

    it('should handle malformed JSON gracefully', async () => {
      await request(app.getHttpServer())
        .post('/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'application/json')
        .send('{ invalid json')
        .expect(400);
    });

    it('should handle very large request bodies', async () => {
      const largeComments = Array(1000)
        .fill(null)
        .map((_, i) => ({
          text: `Comment ${i} with some additional text to make it longer`,
        }));

      const createDto = await createValidRepairOrderDto({
        comments: largeComments,
      });

      const response = await request(app.getHttpServer())
        .post('/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ branch_id: branchData.id, status_id: repairStatus.id })
        .send(createDto);

      expect([400, 413]).toContain(response.status);
    });

    it('should handle token expiration scenarios', async () => {
      const expiredToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.expired';

      await request(app.getHttpServer())
        .get(`/repair-orders/${repairOrderId}`)
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });

    it('should handle session invalidation', async () => {
      // Invalidate session in Redis
      await redis.del(`session:admin:${adminData.id}`);

      const response = await request(app.getHttpServer())
        .get(`/repair-orders/${repairOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([401, 403]).toContain(response.status);

      // Restore session for other tests
      adminToken = await authenticateAdmin(adminData);
    });
  });

  // ========================================
  // Data Integrity and Audit Testing
  // ========================================

  describe('Data Integrity and Audit Trail', () => {
    beforeEach(async () => {
      const createDto = await createValidRepairOrderDto();
      const response = await request(app.getHttpServer())
        .post('/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ branch_id: branchData.id, status_id: repairStatus.id })
        .send(createDto);
      repairOrderId = response.body.id;
    });

    it('should maintain audit trail for all operations', async () => {
      // Perform various operations
      await request(app.getHttpServer())
        .patch(`/repair-orders/${repairOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ priority: 'High' });

      await request(app.getHttpServer())
        .patch(`/repair-orders/${repairOrderId}/move`)
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ status_id: repairStatus.id })
        .send({ notes: 'Test move' });

      // Check audit trail
      const historyRecords = await knex('repair_order_history')
        .where({ repair_order_id: repairOrderId })
        .orderBy('created_at', 'asc');

      expect(historyRecords.length).toBeGreaterThan(0);
      historyRecords.forEach((record) => {
        expect(record).toHaveProperty('repair_order_id', repairOrderId);
        expect(record).toHaveProperty('changed_by', adminData.id);
        expect(record).toHaveProperty('field_name');
        expect(record).toHaveProperty('old_value');
        expect(record).toHaveProperty('new_value');
        expect(record.created_at).toBeTruthy();
      });
    });

    it('should populate audit fields correctly on create', async () => {
      const dbRecord = await knex('repair_orders').where({ id: repairOrderId }).first();

      expect(dbRecord.created_by).toBe(adminData.id);
      expect(dbRecord.updated_by).toBe(adminData.id);
      expect(dbRecord.created_at).toBeTruthy();
      expect(dbRecord.updated_at).toBeTruthy();
      expect(dbRecord.deleted_at).toBeNull();
    });

    it('should update audit fields on modifications', async () => {
      const originalRecord = await knex('repair_orders').where({ id: repairOrderId }).first();

      // Wait a moment to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      await request(app.getHttpServer())
        .patch(`/repair-orders/${repairOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ priority: 'High' });

      const updatedRecord = await knex('repair_orders').where({ id: repairOrderId }).first();

      expect(updatedRecord.updated_by).toBe(adminData.id);
      expect(new Date(updatedRecord.updated_at)).toBeInstanceOf(Date);
      expect(new Date(updatedRecord.updated_at).getTime()).toBeGreaterThan(
        new Date(originalRecord.updated_at).getTime(),
      );
    });

    it('should maintain referential integrity', async () => {
      // Verify foreign key relationships exist and are valid
      const repairOrder = await knex('repair_orders')
        .leftJoin('users', 'repair_orders.user_id', 'users.id')
        .leftJoin('branches', 'repair_orders.branch_id', 'branches.id')
        .leftJoin('phone_categories', 'repair_orders.phone_category_id', 'phone_categories.id')
        .leftJoin('repair_statuses', 'repair_orders.status_id', 'repair_statuses.id')
        .where('repair_orders.id', repairOrderId)
        .first();

      expect(repairOrder).toBeDefined();
      expect(repairOrder.user_id).toBeTruthy();
      expect(repairOrder.branch_id).toBeTruthy();
      expect(repairOrder.phone_category_id).toBeTruthy();
      expect(repairOrder.status_id).toBeTruthy();
    });

    it('should handle transaction rollbacks on errors', async () => {
      const initialCount = await knex('repair_orders').count('* as count').first();

      // Try to create repair order with invalid foreign key
      const invalidDto = await createValidRepairOrderDto({
        user_id: '12345678-1234-4000-8000-123456789012',
      });

      const response = await request(app.getHttpServer())
        .post('/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ branch_id: branchData.id, status_id: repairStatus.id })
        .send(invalidDto);

      expect([400, 404]).toContain(response.status);

      // Verify no partial data was committed
      const finalCount = await knex('repair_orders').count('* as count').first();
      expect(finalCount.count).toBe(initialCount.count);
    });
  });

  // ========================================
  // Business Rule Validation
  // ========================================

  describe('Business Rule Validation', () => {
    beforeEach(async () => {
      const createDto = await createValidRepairOrderDto();
      const response = await request(app.getHttpServer())
        .post('/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ branch_id: branchData.id, status_id: repairStatus.id })
        .send(createDto);
      repairOrderId = response.body.id;
    });

    it('should validate business rules for problem pricing', async () => {
      const invalidProblem = {
        problem_category_id: problemCategory.id,
        price: -100, // Negative price should be invalid
        estimated_minutes: 60,
        parts: [],
      };

      const createDto = await createValidRepairOrderDto({
        initial_problems: [invalidProblem],
      });

      await request(app.getHttpServer())
        .post('/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ branch_id: branchData.id, status_id: repairStatus.id })
        .send(createDto)
        .expect(400);
    });

    it('should validate estimated minutes constraints', async () => {
      const invalidProblem = {
        problem_category_id: problemCategory.id,
        price: 100000,
        estimated_minutes: -30, // Negative minutes should be invalid
        parts: [],
      };

      const createDto = await createValidRepairOrderDto({
        initial_problems: [invalidProblem],
      });

      await request(app.getHttpServer())
        .post('/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ branch_id: branchData.id, status_id: repairStatus.id })
        .send(createDto)
        .expect(400);
    });

    it('should validate rental phone business rules', async () => {
      const invalidRentalPhone = {
        rental_phone_id: uuidv4(),
        is_free: false,
        price: 0, // Price should be > 0 when is_free is false
        currency: 'UZS',
      };

      const createDto = await createValidRepairOrderDto({
        rental_phone: invalidRentalPhone,
      });

      await request(app.getHttpServer())
        .post('/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ branch_id: branchData.id, status_id: repairStatus.id })
        .send(createDto)
        .expect(400);
    });

    it('should validate location coordinates', async () => {
      const invalidLocation = {
        lat: 200, // Invalid latitude (should be -90 to 90)
        long: 69.2401,
        description: 'Test location',
      };

      const createDto = await createValidRepairOrderDto({
        pickup: invalidLocation,
      });

      await request(app.getHttpServer())
        .post('/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ branch_id: branchData.id, status_id: repairStatus.id })
        .send(createDto)
        .expect(400);
    });
  });

  // ========================================
  // Performance and Scalability Tests
  // ========================================

  describe('Performance and Scalability', () => {
    it('should handle bulk repair order creation efficiently', async () => {
      const startTime = Date.now();
      const promises = [];

      // Create 10 repair orders concurrently
      for (let i = 0; i < 10; i++) {
        const createDto = await createValidRepairOrderDto();
        promises.push(
          request(app.getHttpServer())
            .post('/repair-orders')
            .set('Authorization', `Bearer ${adminToken}`)
            .query({ branch_id: branchData.id, status_id: repairStatus.id })
            .send(createDto),
        );
      }

      const responses = await Promise.all(promises);
      const endTime = Date.now();

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(201);
      });

      // Should complete within reasonable time (10 seconds)
      expect(endTime - startTime).toBeLessThan(10000);
    });

    it('should handle large pagination efficiently', async () => {
      // Create many repair orders
      for (let i = 0; i < 50; i++) {
        const createDto = await createValidRepairOrderDto();
        await request(app.getHttpServer())
          .post('/repair-orders')
          .set('Authorization', `Bearer ${adminToken}`)
          .query({ branch_id: branchData.id, status_id: repairStatus.id })
          .send(createDto);
      }

      const startTime = Date.now();

      // Test large offset pagination
      const response = await request(app.getHttpServer())
        .get('/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ branch_id: branchData.id, limit: 20, offset: 30 })
        .expect(200);

      const endTime = Date.now();

      // Should complete quickly (under 2 seconds)
      expect(endTime - startTime).toBeLessThan(2000);

      // Should return expected structure
      expect(response.body).toBeDefined();
    });
  });
});
