import { v4 as uuidv4 } from 'uuid';

import { Knex } from 'knex';

export interface UserFactoryResult {
  id: string;
  phone: string;
  full_name: string;
  email: string;
  address: string;
  birth_date: string;
  status: string;
  registered_at: Date;
  last_login: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  phone_number?: string;
}

export class UserFactory {
  static create(overrides?: Record<string, unknown>): Promise<UserFactoryResult>;
  static create(knex: Knex, overrides?: Record<string, unknown>): Promise<UserFactoryResult>;
  static async create(
    knexOrOverrides: Knex | Record<string, unknown> = {},
    overrides: Record<string, unknown> = {},
  ): Promise<UserFactoryResult> {
    let knex: Knex | null = null;
    let actualOverrides = knexOrOverrides as Record<string, unknown>;

    if (
      knexOrOverrides &&
      typeof (knexOrOverrides as Record<string, unknown>).insert === 'function'
    ) {
      knex = knexOrOverrides as Knex;
      actualOverrides = overrides;
    }

    const data: UserFactoryResult = {
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
    } as UserFactoryResult;

    if (knex) {
      // In this project, users table might have phone_number instead of phone
      // and other differences. Let's adjust based on common patterns if needed.
      const dbData: Record<string, unknown> = { ...data };
      if (dbData.phone && !dbData.phone_number) {
        dbData.phone_number = dbData.phone;
      }

      await knex('users').insert(dbData);
    }

    return data;
  }

  static async createMany(
    count: number,
    overrides: Record<string, unknown> = {},
  ): Promise<UserFactoryResult[]> {
    const results: UserFactoryResult[] = [];
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

  static createDto(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      phone: '+998901234568',
      full_name: 'Test User',
      email: 'user@test.com',
      address: '456 User Street, User City',
      birth_date: '1990-01-01',
      ...overrides,
    };
  }

  static createPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: uuidv4(),
      phone_number: '+998901234568',
      roles: [{ name: 'User', id: 'user-role-id' }],
      ...overrides,
    };
  }
}
