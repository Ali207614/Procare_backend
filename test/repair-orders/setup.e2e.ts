import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { AdminFactory } from '../factories/admin.factory';
import { UserFactory } from '../factories/user.factory';
import { BranchFactory } from '../factories/branch.factory';
import { RoleFactory } from '../factories/role.factory';
import { TestHelpers } from '../utils/test-helpers';
import { v4 as uuidv4 } from 'uuid';
import { Knex } from 'knex';

export interface TestData {
  // Test entities
  adminData: any;
  admin2Data: any;
  superAdminData: any;
  userData: any;
  branchData: any;
  branch2Data: any;
  roleData: any;
  phoneCategory: any;
  repairStatus: any;
  inProgressStatus: any;
  completedStatus: any;
  closedStatus: any;
  problemCategory: any;

  // Auth tokens
  adminToken: string;
  admin2Token: string;
  superAdminToken: string;
  readOnlyToken?: string;
  readOnlyAdminData?: any;
}

export class RepairOrderTestSetup {
  static app: INestApplication;
  static knex: Knex;
  static redis: any;
  static testData: TestData;

  static async setupApplication(): Promise<void> {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    this.app = moduleFixture.createNestApplication();
    this.app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await this.app.init();

    this.knex = moduleFixture.get('KnexConnection');
    this.redis = moduleFixture.get('REDIS_CLIENT');

    await TestHelpers.cleanDatabase(this.knex);
    await this.redis.flushall();

    // Setup test data
    this.testData = await this.setupTestData();
  }

  static async cleanupApplication(): Promise<void> {
    await TestHelpers.cleanDatabase(this.knex);
    await this.redis.flushall();
    await this.app.close();
  }

  static async cleanRepairOrderTables(): Promise<void> {
    // Clean repair orders and related data before each test
    await this.knex.raw('TRUNCATE TABLE repair_order_comments CASCADE');
    await this.knex.raw('TRUNCATE TABLE repair_order_attachments CASCADE');
    await this.knex.raw('TRUNCATE TABLE repair_order_initial_problems CASCADE');
    await this.knex.raw('TRUNCATE TABLE repair_order_final_problems CASCADE');
    await this.knex.raw('TRUNCATE TABLE repair_order_history CASCADE');
    await this.knex.raw('TRUNCATE TABLE repair_orders CASCADE');
  }

  static async setupTestData(): Promise<TestData> {
    // Create branches
    const branchData = await this.createBranch('Main Branch');
    const branch2Data = await this.createBranch('Secondary Branch');

    // Create roles and permissions
    const roleData = await this.createRole('Admin', [
      'repair_orders.create',
      'repair_orders.read',
      'repair_orders.update',
      'repair_orders.delete',
    ]);
    const superAdminRole = await this.createRole('Super Admin', ['*']);
    const limitedRole = await this.createRole('Limited Admin', ['repair_orders.read']);

    // Create admins
    const adminData = await this.createAdmin('Test Admin', branchData.id, roleData.id);
    const admin2Data = await this.createAdmin('Test Admin 2', branch2Data.id, roleData.id);
    const superAdminData = await this.createAdmin('Super Admin', branchData.id, superAdminRole.id);

    // Create user
    const userData = await this.createUser();

    // Create supporting entities
    const phoneCategory = await this.createPhoneCategory();
    const repairStatus = await this.createRepairStatus(branchData.id);

    // Create additional statuses for testing transitions
    const inProgressStatus = await this.createInProgressStatus(branchData.id);
    const completedStatus = await this.createCompletedStatus(branchData.id);
    const closedStatus = await this.createClosedStatus(branchData.id);

    const problemCategory = await this.createProblemCategory();

    // Generate auth tokens
    const adminToken = await this.authenticateAdmin(adminData);
    const admin2Token = await this.authenticateAdmin(admin2Data);
    const superAdminToken = await this.authenticateAdmin(superAdminData);

    return {
      adminData,
      admin2Data,
      superAdminData,
      userData,
      branchData,
      branch2Data,
      roleData,
      phoneCategory,
      repairStatus,
      inProgressStatus,
      completedStatus,
      closedStatus,
      problemCategory,
      adminToken,
      admin2Token,
      superAdminToken,
    };
  }

  static async createReadOnlyAdmin(): Promise<{ readOnlyAdminData: any; readOnlyToken: string }> {
    // Create read-only admin with limited permissions
    const readOnlyRole = await this.createRole('Read Only', ['repair_orders.read']);
    const readOnlyAdminData = await this.createAdmin(
      'Read Only Admin',
      this.testData.branchData.id,
      readOnlyRole.id,
    );
    const readOnlyToken = await this.authenticateAdmin(readOnlyAdminData);

    return { readOnlyAdminData, readOnlyToken };
  }

  static async createBranch(name: string): Promise<any> {
    const branch = BranchFactory.create({ name_uz: name, name_en: name });
    await this.knex('branches').insert(branch);
    return branch;
  }

  static async createRole(name: string, permissions: string[]): Promise<any> {
    const role = RoleFactory.create({ name });
    await this.knex('roles').insert(role);

    // Create permissions if they don't exist and link to role
    for (const permission of permissions) {
      const permissionId = uuidv4();
      await this.knex('permissions')
        .insert({
          id: permissionId,
          name: permission,
          description: `Permission for ${permission}`,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .onConflict('name')
        .ignore();

      const existingPermission = await this.knex('permissions').where('name', permission).first();
      await this.knex('role_permissions')
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

  static async createAdmin(name: string, branchId: string, roleId: string): Promise<any> {
    const admin = AdminFactory.create({
      first_name: name.split(' ')[0],
      last_name: name.split(' ')[1] || 'Admin',
      phone_number: `+99890${Math.floor(Math.random() * 10000000)}`,
      password: await this.hashPassword('password123'),
      status: 'Open',
      is_active: true,
    });
    await this.knex('admins').insert(admin);

    // Link admin to branch
    await this.knex('admin_branches').insert({
      admin_id: admin.id,
      branch_id: branchId,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Link admin to role
    await this.knex('admin_roles').insert({
      admin_id: admin.id,
      role_id: roleId,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return admin;
  }

  static async createUser(): Promise<any> {
    const user = UserFactory.create();
    await this.knex('users').insert(user);
    return user;
  }

  static async createPhoneCategory(): Promise<any> {
    const category = {
      id: uuidv4(),
      name_uz: 'iPhone',
      name_en: 'iPhone',
      name_ru: 'iPhone',
      created_at: new Date(),
      updated_at: new Date(),
    };
    await this.knex('phone_categories').insert(category);
    return category;
  }

  static async createRepairStatus(branchId: string): Promise<any> {
    const status = {
      id: uuidv4(),
      name_uz: 'Kutilmoqda',
      name_en: 'Waiting',
      name_ru: 'Ожидание',
      bg_color: '#f0f0f0',
      color: '#333',
      sort: 1,
      branch_id: branchId,
      created_at: new Date(),
      updated_at: new Date(),
    };
    await this.knex('repair_statuses').insert(status);
    return status;
  }

  static async createInProgressStatus(branchId: string): Promise<any> {
    const status = {
      id: uuidv4(),
      name_uz: 'Jarayonda',
      name_en: 'In Progress',
      name_ru: 'В процессе',
      bg_color: '#ffa500',
      color: '#fff',
      sort: 2,
      branch_id: branchId,
      created_at: new Date(),
      updated_at: new Date(),
    };
    await this.knex('repair_statuses').insert(status);
    return status;
  }

  static async createCompletedStatus(branchId: string): Promise<any> {
    const status = {
      id: uuidv4(),
      name_uz: 'Tugallangan',
      name_en: 'Completed',
      name_ru: 'Завершено',
      bg_color: '#008000',
      color: '#fff',
      sort: 3,
      branch_id: branchId,
      created_at: new Date(),
      updated_at: new Date(),
    };
    await this.knex('repair_statuses').insert(status);
    return status;
  }

  static async createClosedStatus(branchId: string): Promise<any> {
    const status = {
      id: uuidv4(),
      name_uz: 'Yopilgan',
      name_en: 'Closed',
      name_ru: 'Закрыто',
      bg_color: '#808080',
      color: '#fff',
      sort: 4,
      branch_id: branchId,
      created_at: new Date(),
      updated_at: new Date(),
    };
    await this.knex('repair_statuses').insert(status);
    return status;
  }

  static async createProblemCategory(): Promise<any> {
    const category = {
      id: uuidv4(),
      name_uz: 'Ekran muammosi',
      name_en: 'Screen issue',
      name_ru: 'Проблема экрана',
      created_at: new Date(),
      updated_at: new Date(),
    };
    await this.knex('problem_categories').insert(category);
    return category;
  }

  static async hashPassword(password: string): Promise<string> {
    // In real implementation, use bcrypt or similar
    // For testing, return a mock hash
    return `hashed_${password}`;
  }

  static async authenticateAdmin(admin: any): Promise<string> {
    const response = await request(this.app.getHttpServer())
      .post('/auth/admin/login')
      .send({
        phone_number: admin.phone_number,
        password: 'password123',
      })
      .expect(200);

    return response.body.access_token;
  }

  static async createValidRepairOrderDto(overrides = {}): Promise<any> {
    return {
      user_id: this.testData.userData.id,
      phone_category_id: this.testData.phoneCategory.id,
      status_id: this.testData.repairStatus.id,
      priority: 'Medium',
      initial_problems: [
        {
          problem_category_id: this.testData.problemCategory.id,
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

  static async createTestRepairOrder(overrides = {}): Promise<any> {
    const createDto = await this.createValidRepairOrderDto(overrides);
    const response = await request(this.app.getHttpServer())
      .post('/repair-orders')
      .set('Authorization', `Bearer ${this.testData.adminToken}`)
      .query({ branch_id: this.testData.branchData.id, status_id: this.testData.repairStatus.id })
      .send(createDto);

    return response.body;
  }

  // Helper methods for common test operations
  static makeRequest() {
    return request(this.app.getHttpServer());
  }

  static getAdminAuth(): string {
    return `Bearer ${this.testData.adminToken}`;
  }

  static getAdmin2Auth(): string {
    return `Bearer ${this.testData.admin2Token}`;
  }

  static getSuperAdminAuth(): string {
    return `Bearer ${this.testData.superAdminToken}`;
  }
}
