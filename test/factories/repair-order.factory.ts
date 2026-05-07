import { v4 as uuidv4 } from 'uuid';

import { Knex } from 'knex';

export interface RepairOrderFactoryResult {
  id: string;
  branch_id: string;
  customer_phone: string;
  device_type: string;
  brand: string;
  model: string;
  serial_number: string;
  problem_description: string;
  initial_diagnosis: string;
  status: string;
  estimated_cost: number;
  final_cost: number | null;
  completion_notes: string | null;
  created_by: string;
  updated_by: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export class RepairOrderFactory {
  static create(overrides?: Record<string, unknown>): Promise<RepairOrderFactoryResult>;
  static create(knex: Knex, overrides?: Record<string, unknown>): Promise<RepairOrderFactoryResult>;
  static async create(
    knexOrOverrides: Knex | Record<string, unknown> = {},
    overrides: Record<string, unknown> = {},
  ): Promise<RepairOrderFactoryResult> {
    let knex: Knex | null = null;
    let actualOverrides = knexOrOverrides as Record<string, unknown>;

    if (
      knexOrOverrides &&
      typeof (knexOrOverrides as Record<string, unknown>).insert === 'function'
    ) {
      knex = knexOrOverrides as Knex;
      actualOverrides = overrides;
    }

    const data: RepairOrderFactoryResult = {
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
    } as RepairOrderFactoryResult;

    if (knex) {
      await knex('repair_orders').insert(data);
    }

    return data;
  }

  static async createMany(
    count: number,
    overrides: Record<string, unknown> = {},
  ): Promise<RepairOrderFactoryResult[]> {
    const results: RepairOrderFactoryResult[] = [];
    for (let i = 0; i < count; i++) {
      results.push(await this.create(overrides));
    }
    return results;
  }

  static createDto(overrides: Record<string, unknown> = {}): Record<string, unknown> {
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
