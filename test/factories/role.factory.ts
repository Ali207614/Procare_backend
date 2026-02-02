import { v4 as uuidv4 } from 'uuid';

export class RoleFactory {
  static create(overrides = {}) {
    return {
      id: uuidv4(),
      name: 'Test Role',
      description: 'Test role description',
      status: 'Active',
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
        name: `Test Role ${index + 1}`,
        description: `Test role ${index + 1} description`,
        ...overrides,
      }),
    );
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
