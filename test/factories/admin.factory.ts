import { v4 as uuidv4 } from 'uuid';
import { AdminPayload } from '../../src/common/types/admin-payload.interface';

export class AdminFactory {
  static create(overrides = {}) {
    return {
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
      ...overrides,
    };
  }

  static createPayload(overrides = {}): AdminPayload {
    return {
      id: uuidv4(),
      phone_number: '+998901234567',
      roles: [{ name: 'Test Admin', id: 'test-role-id' }],
      ...overrides,
    };
  }

  static createMany(count: number, overrides = {}) {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  static createDto(overrides = {}) {
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
