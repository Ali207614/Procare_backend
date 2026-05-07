import { v4 as uuidv4 } from 'uuid';

import { Knex } from 'knex';

export interface RoleFactoryResult {
  id: string;
  name: string;
  description: string;
  status: string;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export class RoleFactory {
  static create(overrides?: Record<string, unknown>): Promise<RoleFactoryResult>;
  static create(knex: Knex, overrides?: Record<string, unknown>): Promise<RoleFactoryResult>;
  static async create(
    knexOrOverrides: Knex | Record<string, unknown> = {},
    overrides: Record<string, unknown> = {},
  ): Promise<RoleFactoryResult> {
    let knex: Knex | null = null;
    let actualOverrides = knexOrOverrides as Record<string, unknown>;

    if (
      knexOrOverrides &&
      typeof (knexOrOverrides as Record<string, unknown>).insert === 'function'
    ) {
      knex = knexOrOverrides as Knex;
      actualOverrides = overrides;
    }

    const data: RoleFactoryResult = {
      id: uuidv4(),
      name: 'Test Role',
      description: 'Test role description',
      status: 'Active',
      created_by: null,
      updated_by: null,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
      ...actualOverrides,
    } as RoleFactoryResult;

    if (knex) {
      await knex('roles').insert(data);
    }

    return data;
  }

  static async createMany(
    count: number,
    overrides: Record<string, unknown> = {},
  ): Promise<RoleFactoryResult[]> {
    const results: RoleFactoryResult[] = [];
    for (let i = 0; i < count; i++) {
      results.push(
        await this.create({
          name: `Test Role ${i + 1}`,
          description: `Test role ${i + 1} description`,
          ...overrides,
        }),
      );
    }
    return results;
  }

  static createDto(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      name: 'Test Role',
      description: 'Test role description',
      ...overrides,
    };
  }

  static createAdminRole(overrides: Record<string, unknown> = {}): Promise<RoleFactoryResult> {
    return this.create({
      name: 'Admin',
      description: 'Administrator role with full permissions',
      ...overrides,
    });
  }

  static createUserRole(overrides: Record<string, unknown> = {}): Promise<RoleFactoryResult> {
    return this.create({
      name: 'User',
      description: 'Standard user role with limited permissions',
      ...overrides,
    });
  }
}
