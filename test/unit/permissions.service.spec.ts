import { Test, TestingModule } from '@nestjs/testing';
import { PermissionsService } from '../../src/permissions/permissions.service';
import { PermissionFactory } from '../factories/permission.factory';
import { AdminFactory } from '../factories/admin.factory';
import { RoleFactory } from '../factories/role.factory';

describe('PermissionsService', () => {
  let service: PermissionsService;
  let mockKnex: any;
  let mockRedis: any;

  beforeEach(async () => {
    mockKnex = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      first: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      join: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      transaction: jest.fn(),
      raw: jest.fn(),
    };

    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        { provide: 'KnexConnection', useValue: mockKnex },
        { provide: 'RedisClient', useValue: mockRedis },
      ],
    }).compile();

    service = module.get<PermissionsService>(PermissionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return permissions with pagination', async () => {
      // Arrange
      const mockPermissions = PermissionFactory.createMany(3);
      const mockCount = [{ count: '5' }];

      mockKnex.count.mockResolvedValueOnce(mockCount);
      mockKnex.first.mockResolvedValueOnce(mockPermissions);

      // Act
      const result = await service.findAll({ limit: 3, offset: 0 });

      // Assert
      expect(result.data).toEqual(mockPermissions);
      expect(result.meta.total).toBe(5);
    });

    it('should filter by resource', async () => {
      // Arrange
      const mockPermissions = [PermissionFactory.create({ resource: 'repair_orders' })];
      const mockCount = [{ count: '1' }];

      mockKnex.count.mockResolvedValueOnce(mockCount);
      mockKnex.first.mockResolvedValueOnce(mockPermissions);

      // Act
      const result = await service.findAll({ resource: 'repair_orders' });

      // Assert
      expect(mockKnex.where).toHaveBeenCalledWith('permissions.resource', 'repair_orders');
    });

    it('should filter by action', async () => {
      // Arrange
      const mockPermissions = [PermissionFactory.create({ action: 'create' })];
      const mockCount = [{ count: '1' }];

      mockKnex.count.mockResolvedValueOnce(mockCount);
      mockKnex.first.mockResolvedValueOnce(mockPermissions);

      // Act
      const result = await service.findAll({ action: 'create' });

      // Assert
      expect(mockKnex.where).toHaveBeenCalledWith('permissions.action', 'create');
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
      const adminId = 'admin-123';
      const mockInsertId = ['permission-123'];

      mockKnex.first.mockResolvedValueOnce(null); // No duplicate
      mockKnex.insert.mockResolvedValueOnce(mockInsertId);

      // Act
      const result = await service.create(permissionDto, adminId);

      // Assert
      expect(result.message).toBe('Permission created successfully');
      expect(result.permission_id).toBe(mockInsertId[0]);
      expect(mockKnex.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          resource: 'repair_orders',
          action: 'create',
          description: 'Create repair orders',
          created_by: adminId,
        }),
      );
    });

    it('should not create duplicate permission', async () => {
      // Arrange
      const permissionDto = PermissionFactory.createDto({
        resource: 'users',
        action: 'delete',
      });
      const existingPermission = PermissionFactory.create({
        resource: 'users',
        action: 'delete',
      });

      mockKnex.first.mockResolvedValueOnce(existingPermission);

      // Act & Assert
      await expect(service.create(permissionDto, 'admin-123')).rejects.toThrow(
        'Permission already exists',
      );
    });

    it('should invalidate cache after creation', async () => {
      // Arrange
      const permissionDto = PermissionFactory.createDto();
      const mockInsertId = ['permission-123'];

      mockKnex.first.mockResolvedValueOnce(null);
      mockKnex.insert.mockResolvedValueOnce(mockInsertId);
      mockRedis.keys.mockResolvedValueOnce(['permissions:all', 'permissions:resource:users']);

      // Act
      await service.create(permissionDto, 'admin-123');

      // Assert
      expect(mockRedis.del).toHaveBeenCalledWith(['permissions:all', 'permissions:resource:users']);
    });
  });

  describe('findOne', () => {
    it('should return permission by id', async () => {
      // Arrange
      const permissionId = 'permission-123';
      const mockPermission = PermissionFactory.create({ id: permissionId });

      mockKnex.first.mockResolvedValueOnce(mockPermission);

      // Act
      const result = await service.findOne(permissionId);

      // Assert
      expect(result.data).toEqual(mockPermission);
      expect(mockKnex.where).toHaveBeenCalledWith('permissions.id', permissionId);
    });

    it('should throw error for non-existent permission', async () => {
      // Arrange
      mockKnex.first.mockResolvedValueOnce(null);

      // Act & Assert
      await expect(service.findOne('non-existent-id')).rejects.toThrow('Permission not found');
    });
  });

  describe('update', () => {
    it('should update permission successfully', async () => {
      // Arrange
      const permissionId = 'permission-123';
      const updateDto = {
        description: 'Updated description',
        resource: 'updated_resource',
      };
      const adminId = 'admin-123';
      const mockPermission = PermissionFactory.create({ id: permissionId });

      mockKnex.first.mockResolvedValueOnce(mockPermission);
      mockKnex.update.mockResolvedValueOnce(1);

      // Act
      const result = await service.update(permissionId, updateDto, adminId);

      // Assert
      expect(result.message).toBe('Permission updated successfully');
      expect(mockKnex.update).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Updated description',
          resource: 'updated_resource',
          updated_by: adminId,
        }),
      );
    });

    it('should invalidate cache after update', async () => {
      // Arrange
      const permissionId = 'permission-123';
      const updateDto = { description: 'New desc' };
      const mockPermission = PermissionFactory.create({ id: permissionId });

      mockKnex.first.mockResolvedValueOnce(mockPermission);
      mockKnex.update.mockResolvedValueOnce(1);
      mockRedis.keys.mockResolvedValueOnce(['permissions:all']);

      // Act
      await service.update(permissionId, updateDto, 'admin-123');

      // Assert
      expect(mockRedis.del).toHaveBeenCalledWith(['permissions:all']);
    });
  });

  describe('remove', () => {
    it('should soft delete permission', async () => {
      // Arrange
      const permissionId = 'permission-123';
      const adminId = 'admin-123';
      const mockPermission = PermissionFactory.create({ id: permissionId });

      mockKnex.first.mockResolvedValueOnce(mockPermission);
      mockKnex.update.mockResolvedValueOnce(1);

      // Act
      const result = await service.remove(permissionId, adminId);

      // Assert
      expect(result.message).toBe('Permission deleted successfully');
      expect(mockKnex.update).toHaveBeenCalledWith({
        deleted_at: expect.any(Date),
        updated_by: adminId,
      });
    });

    it('should invalidate cache after deletion', async () => {
      // Arrange
      const permissionId = 'permission-123';
      const mockPermission = PermissionFactory.create({ id: permissionId });

      mockKnex.first.mockResolvedValueOnce(mockPermission);
      mockKnex.update.mockResolvedValueOnce(1);
      mockRedis.keys.mockResolvedValueOnce(['permissions:all']);

      // Act
      await service.remove(permissionId, 'admin-123');

      // Assert
      expect(mockRedis.del).toHaveBeenCalledWith(['permissions:all']);
    });
  });

  describe('getPermissionsByRole', () => {
    it('should retrieve permissions for a role', async () => {
      // Arrange
      const roleId = 'role-123';
      const mockPermissions = PermissionFactory.createMany(2);

      mockKnex.first.mockResolvedValueOnce(mockPermissions);

      // Act
      const result = await service.getPermissionsByRole(roleId);

      // Assert
      expect(result.data).toEqual(mockPermissions);
      expect(mockKnex.join).toHaveBeenCalledWith(
        'role_permissions',
        'permissions.id',
        'role_permissions.permission_id',
      );
      expect(mockKnex.where).toHaveBeenCalledWith('role_permissions.role_id', roleId);
    });

    it('should cache permissions by role', async () => {
      // Arrange
      const roleId = 'role-123';
      const mockPermissions = PermissionFactory.createMany(2);

      mockRedis.get.mockResolvedValueOnce(null);
      mockKnex.first.mockResolvedValueOnce(mockPermissions);

      // Act
      await service.getPermissionsByRole(roleId);

      // Assert
      expect(mockRedis.set).toHaveBeenCalledWith(
        `permissions:role:${roleId}`,
        JSON.stringify(mockPermissions),
        'EX',
        3600,
      );
    });

    it('should return cached permissions', async () => {
      // Arrange
      const roleId = 'role-123';
      const cachedPermissions = JSON.stringify(PermissionFactory.createMany(2));

      mockRedis.get.mockResolvedValueOnce(cachedPermissions);

      // Act
      const result = await service.getPermissionsByRole(roleId);

      // Assert
      expect(result.data).toEqual(JSON.parse(cachedPermissions));
      expect(mockKnex.first).not.toHaveBeenCalled();
    });
  });

  describe('checkPermission', () => {
    it('should return true for valid permission', async () => {
      // Arrange
      const adminId = 'admin-123';
      const permission = 'repair_orders.create';
      const mockAdmin = AdminFactory.create({
        id: adminId,
        role_id: 'role-123',
      });
      const mockPermissions = [
        PermissionFactory.create({
          resource: 'repair_orders',
          action: 'create',
        }),
      ];

      mockKnex.first.mockResolvedValueOnce(mockAdmin).mockResolvedValueOnce(mockPermissions);

      // Act
      const result = await service.checkPermission(adminId, permission);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for invalid permission', async () => {
      // Arrange
      const adminId = 'admin-123';
      const permission = 'repair_orders.delete';
      const mockAdmin = AdminFactory.create({
        id: adminId,
        role_id: 'role-123',
      });

      mockKnex.first.mockResolvedValueOnce(mockAdmin).mockResolvedValueOnce([]);

      // Act
      const result = await service.checkPermission(adminId, permission);

      // Assert
      expect(result).toBe(false);
    });

    it('should cache permission check result', async () => {
      // Arrange
      const adminId = 'admin-123';
      const permission = 'repair_orders.create';
      const mockAdmin = AdminFactory.create({ id: adminId });

      mockRedis.get.mockResolvedValueOnce(null);
      mockKnex.first.mockResolvedValueOnce(mockAdmin).mockResolvedValueOnce([]);

      // Act
      await service.checkPermission(adminId, permission);

      // Assert
      expect(mockRedis.set).toHaveBeenCalledWith(
        `admin:${adminId}:permissions`,
        expect.any(String),
        'EX',
        1800,
      );
    });

    it('should return cached result', async () => {
      // Arrange
      const adminId = 'admin-123';
      const permission = 'repair_orders.create';
      const cachedPermissions = JSON.stringify(['repair_orders.create', 'users.read']);

      mockRedis.get.mockResolvedValueOnce(cachedPermissions);

      // Act
      const result = await service.checkPermission(adminId, permission);

      // Assert
      expect(result).toBe(true);
      expect(mockKnex.first).not.toHaveBeenCalled();
    });
  });

  describe('getResourcePermissions', () => {
    it('should retrieve all permissions for a resource', async () => {
      // Arrange
      const resource = 'repair_orders';
      const mockPermissions = [
        PermissionFactory.create({ resource, action: 'create' }),
        PermissionFactory.create({ resource, action: 'read' }),
        PermissionFactory.create({ resource, action: 'update' }),
      ];

      mockKnex.first.mockResolvedValueOnce(mockPermissions);

      // Act
      const result = await service.getResourcePermissions(resource);

      // Assert
      expect(result.data).toEqual(mockPermissions);
      expect(mockKnex.where).toHaveBeenCalledWith('permissions.resource', resource);
    });

    it('should cache resource permissions', async () => {
      // Arrange
      const resource = 'repair_orders';
      const mockPermissions = PermissionFactory.createMany(3);

      mockRedis.get.mockResolvedValueOnce(null);
      mockKnex.first.mockResolvedValueOnce(mockPermissions);

      // Act
      await service.getResourcePermissions(resource);

      // Assert
      expect(mockRedis.set).toHaveBeenCalledWith(
        `permissions:resource:${resource}`,
        JSON.stringify(mockPermissions),
        'EX',
        3600,
      );
    });
  });

  describe('assignPermissionToRole', () => {
    it('should assign permission to role successfully', async () => {
      // Arrange
      const roleId = 'role-123';
      const permissionId = 'permission-123';
      const adminId = 'admin-123';

      mockKnex.first.mockResolvedValueOnce(null); // No existing assignment
      mockKnex.insert.mockResolvedValueOnce(['assignment-123']);

      // Act
      const result = await service.assignPermissionToRole(roleId, permissionId, adminId);

      // Assert
      expect(result.message).toBe('Permission assigned to role successfully');
      expect(mockKnex.insert).toHaveBeenCalledWith({
        role_id: roleId,
        permission_id: permissionId,
        created_by: adminId,
        created_at: expect.any(Date),
      });
    });

    it('should not assign duplicate permission to role', async () => {
      // Arrange
      const roleId = 'role-123';
      const permissionId = 'permission-123';
      const existingAssignment = { role_id: roleId, permission_id: permissionId };

      mockKnex.first.mockResolvedValueOnce(existingAssignment);

      // Act & Assert
      await expect(
        service.assignPermissionToRole(roleId, permissionId, 'admin-123'),
      ).rejects.toThrow('Permission already assigned to role');
    });
  });

  describe('removePermissionFromRole', () => {
    it('should remove permission from role successfully', async () => {
      // Arrange
      const roleId = 'role-123';
      const permissionId = 'permission-123';
      const adminId = 'admin-123';

      mockKnex.update.mockResolvedValueOnce(1);

      // Act
      const result = await service.removePermissionFromRole(roleId, permissionId, adminId);

      // Assert
      expect(result.message).toBe('Permission removed from role successfully');
      expect(mockKnex.where).toHaveBeenCalledWith({
        role_id: roleId,
        permission_id: permissionId,
      });
      expect(mockKnex.update).toHaveBeenCalledWith({
        deleted_at: expect.any(Date),
        updated_by: adminId,
      });
    });
  });

  describe('getAllPermissions', () => {
    it('should return all permissions grouped by resource', async () => {
      // Arrange
      const mockPermissions = [
        PermissionFactory.create({ resource: 'repair_orders', action: 'create' }),
        PermissionFactory.create({ resource: 'repair_orders', action: 'read' }),
        PermissionFactory.create({ resource: 'users', action: 'create' }),
      ];

      mockKnex.orderBy.mockResolvedValueOnce(mockPermissions);

      // Act
      const result = await service.getAllPermissions();

      // Assert
      expect(result.data.repair_orders).toHaveLength(2);
      expect(result.data.users).toHaveLength(1);
    });

    it('should cache all permissions', async () => {
      // Arrange
      const mockPermissions = PermissionFactory.createMany(3);

      mockRedis.get.mockResolvedValueOnce(null);
      mockKnex.orderBy.mockResolvedValueOnce(mockPermissions);

      // Act
      await service.getAllPermissions();

      // Assert
      expect(mockRedis.set).toHaveBeenCalledWith('permissions:all', expect.any(String), 'EX', 3600);
    });
  });
});
