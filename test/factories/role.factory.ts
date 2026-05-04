import { v4 as uuidv4 } from 'uuid';

import { Knex } from 'knex';

export class RoleFactory {
  static async create(knexOrOverrides: any = {}, overrides: any = {}) {
    let knex: Knex | null = null;
    let actualOverrides = knexOrOverrides;

    if (knexOrOverrides && typeof knexOrOverrides.insert === 'function') {
      knex = knexOrOverrides as Knex;
      actualOverrides = overrides;
    }

    const data = {
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
    };

    if (knex) {
      await knex('roles').insert(data);
    }

    return data;
  }

  static async createMany(count: number, overrides = {}) {
    const results = [];
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

  static createDto(overrides = {}) {
    return {
      name: 'Test Role',
      description: 'Test role description',
      ...overrides,
    };
  }

  static createAdminRole(overrides = {}) {
    return this.create({
      name: 'Admin',
      description: 'Administrator role with full permissions',
      ...overrides,
    });
  }

  static createUserRole(overrides = {}) {
    return this.create({
      name: 'User',
      description: 'Standard user role with limited permissions',
      ...overrides,
    });
  }
}
