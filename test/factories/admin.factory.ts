import { v4 as uuidv4 } from 'uuid';
import { AdminPayload } from '../../src/common/types/admin-payload.interface';

import { Knex } from 'knex';

export interface AdminFactoryResult {
  id: string;
  phone: string;
  full_name: string;
  password: string;
  branch_id: string;
  role_id: string;
  is_active: boolean;
  last_login: Date | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export class AdminFactory {
  static create(overrides?: Record<string, unknown>): Promise<AdminFactoryResult>;
  static create(knex: Knex, overrides?: Record<string, unknown>): Promise<AdminFactoryResult>;
  static async create(
    knexOrOverrides: Knex | Record<string, unknown> = {},
    overrides: Record<string, unknown> = {},
  ): Promise<AdminFactoryResult> {
    let knex: Knex | null = null;
    let actualOverrides = knexOrOverrides as Record<string, unknown>;

    if (
      knexOrOverrides &&
      typeof (knexOrOverrides as Record<string, unknown>).insert === 'function'
    ) {
      knex = knexOrOverrides as Knex;
      actualOverrides = overrides;
    }

    const data: AdminFactoryResult = {
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
    } as AdminFactoryResult;

    if (knex) {
      await knex('admins').insert(data);
    }

    return data;
  }

  static createPayload(overrides: Partial<AdminPayload> = {}): AdminPayload {
    return {
      id: uuidv4(),
      phone_number: '+998901234567',
      roles: [{ name: 'Test Admin', id: 'test-role-id' }],
      ...overrides,
    };
  }

  static async createMany(
    count: number,
    overrides: Record<string, unknown> = {},
  ): Promise<AdminFactoryResult[]> {
    const results: AdminFactoryResult[] = [];
    for (let i = 0; i < count; i++) {
      results.push(await this.create(overrides));
    }
    return results;
  }

  static createDto(overrides: Record<string, unknown> = {}): Record<string, unknown> {
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
