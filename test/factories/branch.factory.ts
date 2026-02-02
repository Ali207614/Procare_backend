import { v4 as uuidv4 } from 'uuid';

export class BranchFactory {
  static create(overrides = {}) {
    return {
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
      ...overrides,
    };
  }

  static createMany(count: number, overrides = {}) {
    return Array.from({ length: count }, (_, index) =>
      this.create({
        name: `Test Branch ${index + 1}`,
        ...overrides,
      }),
    );
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
