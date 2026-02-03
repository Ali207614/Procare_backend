import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PermissionsService } from '../src/permissions/permissions.service';
import { AppModule } from '../src/app.module';
import { AdminFactory } from './factories/admin.factory';
import { PermissionFactory } from './factories/permission.factory';
import { RoleFactory } from './factories/role.factory';
import { TestHelpers } from './utils/test-helpers';

describe('PermissionsService (Integration)', () => {
  let app: INestApplication;
  let service: PermissionsService;
  let knex: any;
  let redis: any;
  let adminData: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    service = moduleFixture.get<PermissionsService>(PermissionsService);
    knex = moduleFixture.get('KnexConnection');
    redis = moduleFixture.get('RedisClient');

    adminData = await AdminFactory.create(knex);
  });

  beforeEach(async () => {
    await TestHelpers.cleanPermissionsTable(knex);
    await redis.flushall();
  });

  afterAll(async () => {
    await TestHelpers.cleanDatabase(knex);
    await app.close();
  });

  describe('findAll', () => {
    it('should retrieve all permissions with pagination', async () => {
      // Arrange
      const permissions = await PermissionFactory.createMany(knex, 5);

      // Act
      const result = await service.findAll({ limit: 3, offset: 0 });

      // Assert
      expect(result.data).toHaveLength(3);
      expect(result.meta.total).toBe(5);
      expect(result.meta.limit).toBe(3);
      expect(result.meta.offset).toBe(0);
    });

    it('should filter permissions by resource', async () => {
      // Arrange
      await PermissionFactory.create(knex, { resource: 'repair_orders' });
      await PermissionFactory.create(knex, { resource: 'users' });
      await PermissionFactory.create(knex, { resource: 'repair_orders' });

      // Act
      const result = await service.findAll({ resource: 'repair_orders' });

      // Assert
      expect(result.data).toHaveLength(2);
      expect(result.data.every((p) => p.resource === 'repair_orders')).toBe(true);
    });

    it('should filter permissions by action', async () => {
      // Arrange
      await PermissionFactory.create(knex, { action: 'create' });
      await PermissionFactory.create(knex, { action: 'read' });
      await PermissionFactory.create(knex, { action: 'create' });

      // Act
      const result = await service.findAll({ action: 'create' });

      // Assert
      expect(result.data).toHaveLength(2);
      expect(result.data.every((p) => p.action === 'create')).toBe(true);
    });
  });

  describe('create', () => {
    it('should create permission successfully', async () => {
      // Arrange
      const permissionDto = PermissionFactory.createDto({
        resource: 'repair_orders',
        action: 'create',
        description: 'Create repair orders',
      });

      // Act
      const result = await service.create(permissionDto, adminData.id);

      // Assert
      expect(result.message).toBe('Permission created successfully');

      const permission = await knex('permissions')
        .where({ resource: 'repair_orders', action: 'create' })
        .first();

      expect(permission).toBeDefined();
      expect(permission.description).toBe('Create repair orders');
      expect(permission.created_by).toBe(adminData.id);
    });

    it('should not create duplicate permission', async () => {
      // Arrange
      await PermissionFactory.create(knex, {
        resource: 'users',
        action: 'delete',
      });

      const duplicateDto = PermissionFactory.createDto({
        resource: 'users',
        action: 'delete',
      });

      // Act & Assert
      await expect(service.create(duplicateDto, adminData.id)).rejects.toThrow(
        'Permission already exists',
      );
    });

    it('should invalidate cache after creation', async () => {
      // Arrange
      const cacheKey = 'permissions:all';
      await redis.set(cacheKey, JSON.stringify(['cached_data']));

      const permissionDto = PermissionFactory.createDto();

      // Act
      await service.create(permissionDto, adminData.id);

      // Assert
      const cachedData = await redis.get(cacheKey);
      expect(cachedData).toBeNull();
    });
  });

  describe('findOne', () => {
    it('should retrieve permission by id', async () => {
      // Arrange
      const permission = await PermissionFactory.create(knex);

      // Act
      const result = await service.findOne(permission.id);

      // Assert
      expect(result.data.id).toBe(permission.id);
      expect(result.data.resource).toBe(permission.resource);
      expect(result.data.action).toBe(permission.action);
    });

    it('should throw error for non-existent permission', async () => {
      // Act & Assert
      await expect(service.findOne('non-existent-id')).rejects.toThrow('Permission not found');
    });
  });

  describe('update', () => {
    it('should update permission successfully', async () => {
      // Arrange
      const permission = await PermissionFactory.create(knex, {
        description: 'Old description',
      });

      const updateDto = {
        description: 'Updated description',
        resource: 'updated_resource',
      };

      // Act
      const result = await service.update(permission.id, updateDto, adminData.id);

      // Assert
      expect(result.message).toBe('Permission updated successfully');

      const updatedPermission = await knex('permissions').where({ id: permission.id }).first();

      expect(updatedPermission.description).toBe('Updated description');
      expect(updatedPermission.resource).toBe('updated_resource');
      expect(updatedPermission.updated_by).toBe(adminData.id);
    });

    it('should invalidate cache after update', async () => {
      // Arrange
      const permission = await PermissionFactory.create(knex);
      const cacheKey = 'permissions:all';
      await redis.set(cacheKey, JSON.stringify(['cached_data']));

      // Act
      await service.update(permission.id, { description: 'New desc' }, adminData.id);

      // Assert
      const cachedData = await redis.get(cacheKey);
      expect(cachedData).toBeNull();
    });
  });

  describe('remove', () => {
    it('should soft delete permission', async () => {
      // Arrange
      const permission = await PermissionFactory.create(knex);

      // Act
      const result = await service.remove(permission.id, adminData.id);

      // Assert
      expect(result.message).toBe('Permission deleted successfully');

      const deletedPermission = await knex('permissions').where({ id: permission.id }).first();

      expect(deletedPermission.deleted_at).toBeDefined();
      expect(deletedPermission.updated_by).toBe(adminData.id);
    });

    it('should invalidate cache after deletion', async () => {
      // Arrange
      const permission = await PermissionFactory.create(knex);
      const cacheKey = 'permissions:all';
      await redis.set(cacheKey, JSON.stringify(['cached_data']));

      // Act
      await service.remove(permission.id, adminData.id);

      // Assert
      const cachedData = await redis.get(cacheKey);
      expect(cachedData).toBeNull();
    });
  });

  describe('getPermissionsByRole', () => {
    it('should retrieve permissions for a role', async () => {
      // Arrange
      const role = await RoleFactory.create(knex);
      const permission1 = await PermissionFactory.create(knex);
      const permission2 = await PermissionFactory.create(knex);

      await knex('role_permissions').insert([
        { role_id: role.id, permission_id: permission1.id },
        { role_id: role.id, permission_id: permission2.id },
      ]);

      // Act
      const result = await service.getPermissionsByRole(role.id);

      // Assert
      expect(result.data).toHaveLength(2);
      expect(result.data.map((p) => p.id)).toContain(permission1.id);
      expect(result.data.map((p) => p.id)).toContain(permission2.id);
    });

    it('should cache permissions by role', async () => {
      // Arrange
      const role = await RoleFactory.create(knex);
      const permission = await PermissionFactory.create(knex);

      await knex('role_permissions').insert({
        role_id: role.id,
        permission_id: permission.id,
      });

      // Act
      await service.getPermissionsByRole(role.id);
      const result = await service.getPermissionsByRole(role.id);

      // Assert
      expect(result.data).toHaveLength(1);

      const cacheKey = `permissions:role:${role.id}`;
      const cachedData = await redis.get(cacheKey);
      expect(cachedData).toBeDefined();
    });
  });

  describe('checkPermission', () => {
    it('should return true for valid permission', async () => {
      // Arrange
      const role = await RoleFactory.create(knex);
      const permission = await PermissionFactory.create(knex, {
        resource: 'repair_orders',
        action: 'create',
      });

      await knex('role_permissions').insert({
        role_id: role.id,
        permission_id: permission.id,
      });

      const admin = await AdminFactory.create(knex, { role_id: role.id });

      // Act
      const result = await service.checkPermission(admin.id, 'repair_orders.create');

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for invalid permission', async () => {
      // Arrange
      const admin = await AdminFactory.create(knex);

      // Act
      const result = await service.checkPermission(admin.id, 'repair_orders.delete');

      // Assert
      expect(result).toBe(false);
    });

    it('should cache permission check result', async () => {
      // Arrange
      const admin = await AdminFactory.create(knex);

      // Act
      await service.checkPermission(admin.id, 'repair_orders.create');
      const result = await service.checkPermission(admin.id, 'repair_orders.create');

      // Assert
      const cacheKey = `admin:${admin.id}:permissions`;
      const cachedData = await redis.get(cacheKey);
      expect(cachedData).toBeDefined();
    });
  });

  describe('getResourcePermissions', () => {
    it('should retrieve all permissions for a resource', async () => {
      // Arrange
      await PermissionFactory.create(knex, { resource: 'repair_orders', action: 'create' });
      await PermissionFactory.create(knex, { resource: 'repair_orders', action: 'read' });
      await PermissionFactory.create(knex, { resource: 'users', action: 'create' });

      // Act
      const result = await service.getResourcePermissions('repair_orders');

      // Assert
      expect(result.data).toHaveLength(2);
      expect(result.data.every((p) => p.resource === 'repair_orders')).toBe(true);
    });
  });
});
