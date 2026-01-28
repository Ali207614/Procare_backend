import { INestApplication } from '@nestjs/common';
import { Knex } from 'knex';
import * as request from 'supertest';
import { faker } from '@faker-js/faker';

export class TestHelpers {
  static async authenticateAdmin(app: INestApplication): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/admin/login')
      .send({
        phone: '+998901234567',
        password: 'testpass'
      });
    return response.body.access_token;
  }

  static async cleanDatabase(knex: Knex): Promise<void> {
    const tables = [
      'repair_order_attachments',
      'repair_order_comments',
      'repair_orders',
      'rental_phones',
      'users',
      'admin_permissions',
      'admins',
      'branches',
      'permissions',
      'roles',
      'problem_categories',
      'campaigns'
    ];

    // Clean in order to avoid foreign key constraints
    for (const table of tables) {
      await knex(table).del();
    }
  }

  static async seedTestData(knex: Knex): Promise<any> {
    // Create test branch
    const [branch] = await knex('branches')
      .insert({
        id: faker.string.uuid(),
        name: 'Test Branch',
        address: 'Test Address',
        phone: '+998901234567',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    // Create test role
    const [role] = await knex('roles')
      .insert({
        id: faker.string.uuid(),
        name: 'Test Admin',
        description: 'Test role for admin',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    // Create test admin
    const [admin] = await knex('admins')
      .insert({
        id: faker.string.uuid(),
        phone: '+998901234567',
        password: '$2b$12$hash', // bcrypt hash for 'testpass'
        full_name: 'Test Admin',
        branch_id: branch.id,
        role_id: role.id,
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    return { branch, role, admin };
  }
}

export class MockFactory {
  static createRepairOrder(overrides = {}) {
    return {
      id: faker.string.uuid(),
      customer_phone: '+998901234567',
      device_type: 'Smartphone',
      brand: 'Samsung',
      model: 'Galaxy S21',
      problem_description: 'Screen not working',
      status: 'Open',
      created_at: new Date(),
      updated_at: new Date(),
      ...overrides,
    };
  }

  static createAdmin(overrides = {}) {
    return {
      id: faker.string.uuid(),
      phone: '+998901234567',
      full_name: 'Test Admin',
      status: 'Active',
      branch_id: faker.string.uuid(),
      role_id: faker.string.uuid(),
      ...overrides,
    };
  }

  static createBranch(overrides = {}) {
    return {
      id: faker.string.uuid(),
      name: 'Test Branch',
      address: 'Test Address',
      phone: '+998901234567',
      created_at: new Date(),
      updated_at: new Date(),
      ...overrides,
    };
  }

  static createManyRepairOrders(count: number, overrides = {}) {
    return Array.from({ length: count }, () => this.createRepairOrder(overrides));
  }
}