import { v4 as uuidv4 } from 'uuid';

export class RepairOrderFactory {
  static create(overrides = {}) {
    return {
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
      ...overrides,
    };
  }

  static createMany(count: number, overrides = {}) {
    return Array.from({ length: count }, () => this.create(overrides));
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
