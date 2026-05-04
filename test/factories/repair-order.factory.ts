import { v4 as uuidv4 } from 'uuid';

import { Knex } from 'knex';

export class RepairOrderFactory {
  static async create(knexOrOverrides: any = {}, overrides: any = {}) {
    let knex: Knex | null = null;
    let actualOverrides = knexOrOverrides;

    if (knexOrOverrides && typeof knexOrOverrides.insert === 'function') {
      knex = knexOrOverrides as Knex;
      actualOverrides = overrides;
    }

    const data = {
      id: uuidv4(),
      branch_id: 'test-branch-id',
      customer_phone: '+998901234567',
      device_type: 'Smartphone',
      brand: 'Samsung',
      model: 'Galaxy S21',
      serial_number: 'SN123456789',
      problem_description: 'Screen not working',
      initial_diagnosis: 'Display issue',
      status: 'Open',
      estimated_cost: 100000,
      final_cost: null,
      completion_notes: null,
      created_by: 'test-admin-id',
      updated_by: 'test-admin-id',
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
      ...actualOverrides,
    };

    if (knex) {
      await knex('repair_orders').insert(data);
    }

    return data;
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
      customer_phone: '+998901234567',
      device_type: 'Smartphone',
      brand: 'Samsung',
      model: 'Galaxy S21',
      serial_number: 'SN123456789',
      problem_description: 'Screen not working',
      estimated_cost: 100000,
      ...overrides,
    };
  }
}
