import { v4 as uuidv4 } from 'uuid';
import { AdminPayload } from '../../src/common/types/admin-payload.interface';

import { Knex } from 'knex';

export class AdminFactory {
  static create(overrides?: any): Promise<any>;
  static create(knex: Knex, overrides?: any): Promise<any>;
  static async create(knexOrOverrides: any = {}, overrides: any = {}): Promise<any> {
    let knex: Knex | null = null;
    let actualOverrides = knexOrOverrides;

    if (knexOrOverrides && typeof knexOrOverrides.insert === 'function') {
      knex = knexOrOverrides as Knex;
      actualOverrides = overrides;
    }

    const data = {
      id: uuidv4(),
      phone: '+998901234567',
      full_name: 'Test Admin',
      password: 'hashedpassword123',
      branch_id: 'test-branch-id',
      role_id: 'test-role-id',
      is_active: true,
      last_login: null,
      created_by: null,
      updated_by: null,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
      ...actualOverrides,
    };

    if (knex) {
      await knex('admins').insert(data);
    }

    return data;
  }

  static createPayload(overrides = {}): AdminPayload {
    return {
      id: uuidv4(),
      phone_number: '+998901234567',
      roles: [{ name: 'Test Admin', id: 'test-role-id' }],
      ...overrides,
    };
  }

  static async createMany(count: number, overrides = {}) {
    const results = [];
    for (let i = 0; i < count; i++) {
      results.push(await this.create(overrides));
    }
    return results;
  }

  static createDto(overrides = {}) {
    return {
      phone: '+998901234567',
      full_name: 'Test Admin',
      password: 'password123',
      branch_id: 'test-branch-id',
      role_id: 'test-role-id',
      ...overrides,
    };
  }
}
