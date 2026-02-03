import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { RolesService } from '../src/roles/roles.service';
import { AppModule } from '../src/app.module';
import { AdminFactory } from './factories/admin.factory';
import { RoleFactory } from './factories/role.factory';
import { PermissionFactory } from './factories/permission.factory';
import { TestHelpers } from './utils/test-helpers';

describe('RolesService (Integration)', () => {
  let app: INestApplication;
  let service: RolesService;
  let knex: any;
  let redis: any;
  let adminData: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    service = moduleFixture.get<RolesService>(RolesService);
    knex = moduleFixture.get('KnexConnection');
    redis = moduleFixture.get('RedisClient');

    adminData = await AdminFactory.create(knex);
  });

  beforeEach(async () => {
    await TestHelpers.cleanRolesTable(knex);
    await redis.flushall();
  });

  afterAll(async () => {
    await TestHelpers.cleanDatabase(knex);
    await app.close();
  });

  describe('findAll', () => {
    it('should retrieve all roles with pagination', async () => {
      // Arrange
      const roles = await RoleFactory.createMany(knex, 5);

      // Act
      const result = await service.findAll({ limit: 3, offset: 0 });

      // Assert
      expect(result.data).toHaveLength(3);
      expect(result.meta.total).toBe(5);
      expect(result.meta.limit).toBe(3);
      expect(result.meta.offset).toBe(0);
    });

    it('should search roles by name', async () => {
      // Arrange
      await RoleFactory.create(knex, { name: 'Administrator' });
      await RoleFactory.create(knex, { name: 'Technician' });
      await RoleFactory.create(knex, { name: 'Manager' });

      // Act
      const result = await service.findAll({ search: 'admin' });

      // Assert
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Administrator');
    });
  });

  describe('create', () => {
    it('should create role successfully', async () => {
      // Arrange
      const roleDto = RoleFactory.createDto({
        name: 'Test Role',
        description: 'Test role description',
      });

      // Act
      const result = await service.create(roleDto, adminData.id);

      // Assert
      expect(result.message).toBe('Role created successfully');

      const role = await knex('roles').where({ name: 'Test Role' }).first();

      expect(role).toBeDefined();
      expect(role.description).toBe('Test role description');
      expect(role.created_by).toBe(adminData.id);
    });

    it('should not create duplicate role name', async () => {
      // Arrange
      await RoleFactory.create(knex, { name: 'Unique Role' });

      const duplicateDto = RoleFactory.createDto({
        name: 'Unique Role',
      });

      // Act & Assert
      await expect(service.create(duplicateDto, adminData.id)).rejects.toThrow(
        'Role name already exists',
      );
    });

    it('should invalidate cache after creation', async () => {
      // Arrange
      const cacheKey = 'roles:all';
      await redis.set(cacheKey, JSON.stringify(['cached_data']));

      const roleDto = RoleFactory.createDto();

      // Act
      await service.create(roleDto, adminData.id);

      // Assert
      const cachedData = await redis.get(cacheKey);
      expect(cachedData).toBeNull();
    });
  });

  describe('createRoleWithPermissions', () => {
    it('should create role with permissions successfully', async () => {
      // Arrange
      const permission1 = await PermissionFactory.create(knex);
      const permission2 = await PermissionFactory.create(knex);

      const roleDto = RoleFactory.createDto({
        name: 'Role with Permissions',
        permission_ids: [permission1.id, permission2.id],
      });

      // Act
      const result = await service.createRoleWithPermissions(roleDto, adminData.id);

      // Assert
      expect(result.message).toBe('Role created with permissions successfully');

      const role = await knex('roles').where({ name: 'Role with Permissions' }).first();

      const rolePermissions = await knex('role_permissions').where({ role_id: role.id });

      expect(rolePermissions).toHaveLength(2);
      expect(rolePermissions.map((rp) => rp.permission_id)).toContain(permission1.id);
      expect(rolePermissions.map((rp) => rp.permission_id)).toContain(permission2.id);
    });

    it('should validate permission ids exist', async () => {
      // Arrange
      const roleDto = RoleFactory.createDto({
        permission_ids: ['non-existent-id'],
      });

      // Act & Assert
      await expect(service.createRoleWithPermissions(roleDto, adminData.id)).rejects.toThrow(
        'Some permission IDs do not exist',
      );
    });
  });

  describe('findOne', () => {
    it('should retrieve role by id with permissions', async () => {
      // Arrange
      const role = await RoleFactory.create(knex);
      const permission = await PermissionFactory.create(knex);

      await knex('role_permissions').insert({
        role_id: role.id,
        permission_id: permission.id,
      });

      // Act
      const result = await service.findOne(role.id);

      // Assert
      expect(result.data.id).toBe(role.id);
      expect(result.data.name).toBe(role.name);
      expect(result.data.permissions).toHaveLength(1);
      expect(result.data.permissions[0].id).toBe(permission.id);
    });

    it('should throw error for non-existent role', async () => {
      // Act & Assert
      await expect(service.findOne('non-existent-id')).rejects.toThrow('Role not found');
    });
  });

  describe('update', () => {
    it('should update role successfully', async () => {
      // Arrange
      const role = await RoleFactory.create(knex, {
        name: 'Original Name',
        description: 'Original description',
      });

      const updateDto = {
        name: 'Updated Name',
        description: 'Updated description',
      };

      // Act
      const result = await service.update(role.id, updateDto, adminData.id);

      // Assert
      expect(result.message).toBe('Role updated successfully');

      const updatedRole = await knex('roles').where({ id: role.id }).first();

      expect(updatedRole.name).toBe('Updated Name');
      expect(updatedRole.description).toBe('Updated description');
      expect(updatedRole.updated_by).toBe(adminData.id);
    });

    it('should not allow duplicate name on update', async () => {
      // Arrange
      await RoleFactory.create(knex, { name: 'Existing Role' });
      const role = await RoleFactory.create(knex, { name: 'Another Role' });

      // Act & Assert
      await expect(
        service.update(role.id, { name: 'Existing Role' }, adminData.id),
      ).rejects.toThrow('Role name already exists');
    });
  });

  describe('updateRolePermissions', () => {
    it('should update role permissions successfully', async () => {
      // Arrange
      const role = await RoleFactory.create(knex);
      const oldPermission = await PermissionFactory.create(knex);
      const newPermission1 = await PermissionFactory.create(knex);
      const newPermission2 = await PermissionFactory.create(knex);

      await knex('role_permissions').insert({
        role_id: role.id,
        permission_id: oldPermission.id,
      });

      const updateDto = {
        permission_ids: [newPermission1.id, newPermission2.id],
      };

      // Act
      const result = await service.updateRolePermissions(role.id, updateDto, adminData.id);

      // Assert
      expect(result.message).toBe('Role permissions updated successfully');

      const rolePermissions = await knex('role_permissions').where({ role_id: role.id });

      expect(rolePermissions).toHaveLength(2);
      expect(rolePermissions.map((rp) => rp.permission_id)).toContain(newPermission1.id);
      expect(rolePermissions.map((rp) => rp.permission_id)).toContain(newPermission2.id);
      expect(rolePermissions.map((rp) => rp.permission_id)).not.toContain(oldPermission.id);
    });

    it('should remove all permissions when empty array provided', async () => {
      // Arrange
      const role = await RoleFactory.create(knex);
      const permission = await PermissionFactory.create(knex);

      await knex('role_permissions').insert({
        role_id: role.id,
        permission_id: permission.id,
      });

      // Act
      const result = await service.updateRolePermissions(
        role.id,
        { permission_ids: [] },
        adminData.id,
      );

      // Assert
      expect(result.message).toBe('Role permissions updated successfully');

      const rolePermissions = await knex('role_permissions').where({ role_id: role.id });

      expect(rolePermissions).toHaveLength(0);
    });
  });

  describe('remove', () => {
    it('should soft delete role', async () => {
      // Arrange
      const role = await RoleFactory.create(knex);

      // Act
      const result = await service.remove(role.id, adminData.id);

      // Assert
      expect(result.message).toBe('Role deleted successfully');

      const deletedRole = await knex('roles').where({ id: role.id }).first();

      expect(deletedRole.deleted_at).toBeDefined();
      expect(deletedRole.updated_by).toBe(adminData.id);
    });

    it('should not delete role with assigned admins', async () => {
      // Arrange
      const role = await RoleFactory.create(knex);
      await AdminFactory.create(knex, { role_id: role.id });

      // Act & Assert
      await expect(service.remove(role.id, adminData.id)).rejects.toThrow(
        'Cannot delete role with assigned admins',
      );
    });

    it('should invalidate cache after deletion', async () => {
      // Arrange
      const role = await RoleFactory.create(knex);
      const cacheKey = 'roles:all';
      await redis.set(cacheKey, JSON.stringify(['cached_data']));

      // Act
      await service.remove(role.id, adminData.id);

      // Assert
      const cachedData = await redis.get(cacheKey);
      expect(cachedData).toBeNull();
    });
  });

  describe('getAdminsByRole', () => {
    it('should retrieve admins for a role', async () => {
      // Arrange
      const role = await RoleFactory.create(knex);
      const admin1 = await AdminFactory.create(knex, { role_id: role.id });
      const admin2 = await AdminFactory.create(knex, { role_id: role.id });
      await AdminFactory.create(knex); // Different role

      // Act
      const result = await service.getAdminsByRole(role.id);

      // Assert
      expect(result.data).toHaveLength(2);
      expect(result.data.map((a) => a.id)).toContain(admin1.id);
      expect(result.data.map((a) => a.id)).toContain(admin2.id);
    });
  });

  describe('getRoleStats', () => {
    it('should return role statistics', async () => {
      // Arrange
      const role1 = await RoleFactory.create(knex);
      const role2 = await RoleFactory.create(knex);

      await AdminFactory.create(knex, { role_id: role1.id });
      await AdminFactory.create(knex, { role_id: role1.id });
      await AdminFactory.create(knex, { role_id: role2.id });

      // Act
      const result = await service.getRoleStats();

      // Assert
      expect(result.data.total_roles).toBe(2);
      expect(result.data.roles_with_admins).toBe(2);
      expect(result.data.total_admin_assignments).toBe(3);
    });
  });
});
