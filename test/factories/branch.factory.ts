import { v4 as uuidv4 } from 'uuid';

import { Knex } from 'knex';

export interface BranchFactoryResult {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  manager_id: string | null;
  status: string;
  working_hours: Record<string, unknown>;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export class BranchFactory {
  static create(overrides?: Record<string, unknown>): Promise<BranchFactoryResult>;
  static create(knex: Knex, overrides?: Record<string, unknown>): Promise<BranchFactoryResult>;
  static async create(
    knexOrOverrides: Knex | Record<string, unknown> = {},
    overrides: Record<string, unknown> = {},
  ): Promise<BranchFactoryResult> {
    let knex: Knex | null = null;
    let actualOverrides = knexOrOverrides as Record<string, unknown>;

    if (
      knexOrOverrides &&
      typeof (knexOrOverrides as Record<string, unknown>).insert === 'function'
    ) {
      knex = knexOrOverrides as Knex;
      actualOverrides = overrides;
    }

    const data: BranchFactoryResult = {
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
    } as BranchFactoryResult;

    if (knex) {
      await knex('branches').insert(data);
    }

    return data;
  }

  static async createMany(
    count: number,
    overrides: Record<string, unknown> = {},
  ): Promise<BranchFactoryResult[]> {
    const results: BranchFactoryResult[] = [];
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

  static createDto(overrides: Record<string, unknown> = {}): Record<string, unknown> {
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
