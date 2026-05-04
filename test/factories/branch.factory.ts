import { v4 as uuidv4 } from 'uuid';

import { Knex } from 'knex';

export class BranchFactory {
  static async create(knexOrOverrides: any = {}, overrides: any = {}) {
    let knex: Knex | null = null;
    let actualOverrides = knexOrOverrides;

    if (knexOrOverrides && typeof knexOrOverrides.insert === 'function') {
      knex = knexOrOverrides as Knex;
      actualOverrides = overrides;
    }

    const data = {
      id: uuidv4(),
      name: 'Test Branch',
      address: '123 Test Street, Test City',
      phone: '+998901234567',
      email: 'test@branch.com',
      manager_id: null,
      status: 'Active',
      working_hours: {
        monday: { open: '09:00', close: '18:00' },
        tuesday: { open: '09:00', close: '18:00' },
        wednesday: { open: '09:00', close: '18:00' },
        thursday: { open: '09:00', close: '18:00' },
        friday: { open: '09:00', close: '18:00' },
        saturday: { open: '10:00', close: '16:00' },
        sunday: { closed: true },
      },
      created_by: null,
      updated_by: null,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
      ...actualOverrides,
    };

    if (knex) {
      await knex('branches').insert(data);
    }

    return data;
  }

  static async createMany(count: number, overrides = {}) {
    const results = [];
    for (let i = 0; i < count; i++) {
      results.push(
        await this.create({
          name: `Test Branch ${i + 1}`,
          ...overrides,
        }),
      );
    }
    return results;
  }

  static createDto(overrides = {}) {
    return {
      name: 'Test Branch',
      address: '123 Test Street, Test City',
      phone: '+998901234567',
      email: 'test@branch.com',
      working_hours: {
        monday: { open: '09:00', close: '18:00' },
        tuesday: { open: '09:00', close: '18:00' },
        wednesday: { open: '09:00', close: '18:00' },
        thursday: { open: '09:00', close: '18:00' },
        friday: { open: '09:00', close: '18:00' },
        saturday: { open: '10:00', close: '16:00' },
        sunday: { closed: true },
      },
      ...overrides,
    };
  }
}
