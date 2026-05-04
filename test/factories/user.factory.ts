import { v4 as uuidv4 } from 'uuid';

import { Knex } from 'knex';

export class UserFactory {
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
      phone: '+998901234568',
      full_name: 'Test User',
      email: 'user@test.com',
      address: '456 User Street, User City',
      birth_date: '1990-01-01',
      status: 'Active',
      registered_at: new Date(),
      last_login: null,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
      ...actualOverrides,
    };

    if (knex) {
      // In this project, users table might have phone_number instead of phone
      // and other differences. Let's adjust based on common patterns if needed.
      const dbData = { ...data };
      if (dbData.phone && !dbData.phone_number) {
        (dbData as any).phone_number = dbData.phone;
      }
      
      await knex('users').insert(dbData);
    }

    return data;
  }

  static async createMany(count: number, overrides = {}) {
    const results = [];
    for (let i = 0; i < count; i++) {
      results.push(
        await this.create({
          phone: `+99890123456${i}`,
          full_name: `Test User ${i + 1}`,
          email: `user${i + 1}@test.com`,
          ...overrides,
        }),
      );
    }
    return results;
  }

  static createDto(overrides = {}) {
    return {
      phone: '+998901234568',
      full_name: 'Test User',
      email: 'user@test.com',
      address: '456 User Street, User City',
      birth_date: '1990-01-01',
      ...overrides,
    };
  }

  static createPayload(overrides = {}) {
    return {
      id: uuidv4(),
      phone_number: '+998901234568',
      roles: [{ name: 'User', id: 'user-role-id' }],
      ...overrides,
    };
  }
}
