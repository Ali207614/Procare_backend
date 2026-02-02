import { v4 as uuidv4 } from 'uuid';

export class UserFactory {
  static create(overrides = {}) {
    return {
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
      ...overrides,
    };
  }

  static createMany(count: number, overrides = {}) {
    return Array.from({ length: count }, (_, index) =>
      this.create({
        phone: `+99890123456${index}`,
        full_name: `Test User ${index + 1}`,
        email: `user${index + 1}@test.com`,
        ...overrides,
      }),
    );
  }

  static createDto(overrides = {}) {
    return {
      phone: '+998901234568',
      full_name: 'Test User',
      email: 'user@test.com',
      address: '456 User Street, User City',
      birth_date: '1990-01-01',
      ...overrides,
    };
  }

  static createPayload(overrides = {}) {
    return {
      id: uuidv4(),
      phone_number: '+998901234568',
      roles: [{ name: 'User', id: 'user-role-id' }],
      ...overrides,
    };
  }
}
