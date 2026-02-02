import { Test, TestingModule } from '@nestjs/testing';
import { RolesService } from '../../src/roles/roles.service';
import { RoleFactory } from '../factories/role.factory';
import { AdminFactory } from '../factories/admin.factory';
import { PermissionFactory } from '../factories/permission.factory';

describe('RolesService', () => {
  let service: RolesService;
  let mockKnex: any;
  let mockRedis: any;

  beforeEach(async () => {
    mockKnex = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      whereNot: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      first: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      del: jest.fn(),
      count: jest.fn(),
      join: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      transaction: jest.fn(),
      raw: jest.fn(),
      whereILike: jest.fn().mockReturnThis(),
    };

    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: 'KnexConnection', useValue: mockKnex },
        { provide: 'RedisClient', useValue: mockRedis },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return roles with pagination', async () => {
      // Arrange
      const mockRoles = RoleFactory.createMany(3);
      const mockCount = [{ count: '5' }];

      mockKnex.count.mockResolvedValueOnce(mockCount);
      mockKnex.first.mockResolvedValueOnce(mockRoles);

      // Act
      const result = await service.findAll({ limit: 3, offset: 0 });

      // Assert
      expect(result.data).toEqual(mockRoles);
      expect(result.meta.total).toBe(5);
    });

    it('should search roles by name', async () => {
      // Arrange
      const mockRoles = [RoleFactory.create({ name: 'Administrator' })];
      const mockCount = [{ count: '1' }];

      mockKnex.count.mockResolvedValueOnce(mockCount);
      mockKnex.first.mockResolvedValueOnce(mockRoles);

      // Act
      const result = await service.findAll({ search: 'admin' });

      // Assert
      expect(mockKnex.whereILike).toHaveBeenCalledWith('roles.name', '%admin%');
    });
  });

  describe('create', () => {
    it('should create role successfully', async () => {
      // Arrange
      const roleDto = RoleFactory.createDto({
        name: 'Test Role',
        description: 'Test role description',
      });
      const adminId = 'admin-123';
      const mockInsertId = ['role-123'];

      mockKnex.first.mockResolvedValueOnce(null); // No duplicate
      mockKnex.insert.mockResolvedValueOnce(mockInsertId);

      // Act
      const result = await service.create(roleDto, adminId);

      // Assert
      expect(result.message).toBe('Role created successfully');
      expect(result.role_id).toBe(mockInsertId[0]);
      expect(mockKnex.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Role',
          description: 'Test role description',
          created_by: adminId,
        }),
      );
    });

    it('should not create duplicate role name', async () => {
      // Arrange
      const roleDto = RoleFactory.createDto({ name: 'Unique Role' });
      const existingRole = RoleFactory.create({ name: 'Unique Role' });

      mockKnex.first.mockResolvedValueOnce(existingRole);

      // Act & Assert
      await expect(service.create(roleDto, 'admin-123')).rejects.toThrow(
        'Role name already exists',
      );
    });

    it('should invalidate cache after creation', async () => {
      // Arrange
      const roleDto = RoleFactory.createDto();
      const mockInsertId = ['role-123'];

      mockKnex.first.mockResolvedValueOnce(null);
      mockKnex.insert.mockResolvedValueOnce(mockInsertId);
      mockRedis.keys.mockResolvedValueOnce(['roles:all']);

      // Act
      await service.create(roleDto, 'admin-123');

      // Assert
      expect(mockRedis.del).toHaveBeenCalledWith(['roles:all']);
    });
  });

  describe('createRoleWithPermissions', () => {
    it('should create role with permissions successfully', async () => {
      // Arrange
      const permission1 = PermissionFactory.create();
      const permission2 = PermissionFactory.create();
      const roleDto = RoleFactory.createDto({
        name: 'Role with Permissions',
        permission_ids: [permission1.id, permission2.id],
      });
      const adminId = 'admin-123';
      const mockInsertId = ['role-123'];

      mockKnex.first.mockResolvedValueOnce(null); // No duplicate role
      mockKnex.insert.mockResolvedValueOnce(mockInsertId);
      mockKnex.whereIn.mockReturnThis();
      mockKnex.count.mockResolvedValueOnce([{ count: '2' }]); // All permissions exist
      mockKnex.transaction.mockImplementation((callback) => callback(mockKnex));

      // Act
      const result = await service.createRoleWithPermissions(roleDto, adminId);

      // Assert
      expect(result.message).toBe('Role created with permissions successfully');
      expect(mockKnex.insert).toHaveBeenCalledTimes(2); // Role + permissions
    });

    it('should validate permission ids exist', async () => {
      // Arrange
      const roleDto = RoleFactory.createDto({
        permission_ids: ['non-existent-id'],
      });

      mockKnex.first.mockResolvedValueOnce(null);
      mockKnex.whereIn.mockReturnThis();
      mockKnex.count.mockResolvedValueOnce([{ count: '0' }]);

      // Act & Assert
      await expect(service.createRoleWithPermissions(roleDto, 'admin-123')).rejects.toThrow(
        'Some permission IDs do not exist',
      );
    });
  });

  describe('findOne', () => {
    it('should return role by id with permissions', async () => {
      // Arrange
      const roleId = 'role-123';
      const mockRole = RoleFactory.create({ id: roleId });
      const mockPermissions = PermissionFactory.createMany(2);

      mockKnex.first.mockResolvedValueOnce(mockRole).mockResolvedValueOnce(mockPermissions);

      // Act
      const result = await service.findOne(roleId);

      // Assert
      expect(result.data.id).toBe(roleId);
      expect(result.data.permissions).toEqual(mockPermissions);
      expect(mockKnex.join).toHaveBeenCalledWith(
        'role_permissions',
        'permissions.id',
        'role_permissions.permission_id',
      );
    });

    it('should throw error for non-existent role', async () => {
      // Arrange
      mockKnex.first.mockResolvedValueOnce(null);

      // Act & Assert
      await expect(service.findOne('non-existent-id')).rejects.toThrow('Role not found');
    });
  });

  describe('update', () => {
    it('should update role successfully', async () => {
      // Arrange
      const roleId = 'role-123';
      const updateDto = {
        name: 'Updated Name',
        description: 'Updated description',
      };
      const adminId = 'admin-123';
      const mockRole = RoleFactory.create({ id: roleId, name: 'Original Name' });

      mockKnex.first.mockResolvedValueOnce(mockRole);
      mockKnex.update.mockResolvedValueOnce(1);

      // Act
      const result = await service.update(roleId, updateDto, adminId);

      // Assert
      expect(result.message).toBe('Role updated successfully');
      expect(mockKnex.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Name',
          description: 'Updated description',
          updated_by: adminId,
        }),
      );
    });

    it('should not allow duplicate name on update', async () => {
      // Arrange
      const roleId = 'role-123';
      const updateDto = { name: 'Existing Role' };
      const mockRole = RoleFactory.create({ id: roleId, name: 'Another Role' });
      const existingRole = RoleFactory.create({ name: 'Existing Role' });

      mockKnex.first.mockResolvedValueOnce(mockRole).mockResolvedValueOnce(existingRole);

      // Act & Assert
      await expect(service.update(roleId, updateDto, 'admin-123')).rejects.toThrow(
        'Role name already exists',
      );
    });
  });

  describe('updateRolePermissions', () => {
    it('should update role permissions successfully', async () => {
      // Arrange
      const roleId = 'role-123';
      const newPermission1 = PermissionFactory.create();
      const newPermission2 = PermissionFactory.create();
      const updateDto = {
        permission_ids: [newPermission1.id, newPermission2.id],
      };
      const adminId = 'admin-123';
      const mockRole = RoleFactory.create({ id: roleId });

      mockKnex.first.mockResolvedValueOnce(mockRole);
      mockKnex.whereIn.mockReturnThis();
      mockKnex.count.mockResolvedValueOnce([{ count: '2' }]);
      mockKnex.update.mockResolvedValueOnce(1); // Delete old permissions
      mockKnex.insert.mockResolvedValueOnce(['rp1', 'rp2']);
      mockKnex.transaction.mockImplementation((callback) => callback(mockKnex));

      // Act
      const result = await service.updateRolePermissions(roleId, updateDto, adminId);

      // Assert
      expect(result.message).toBe('Role permissions updated successfully');
      expect(mockKnex.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          role_id: roleId,
          permission_id: newPermission1.id,
        }),
        expect.objectContaining({
          role_id: roleId,
          permission_id: newPermission2.id,
        }),
      ]);
    });

    it('should remove all permissions when empty array provided', async () => {
      // Arrange
      const roleId = 'role-123';
      const updateDto = { permission_ids: [] };
      const mockRole = RoleFactory.create({ id: roleId });

      mockKnex.first.mockResolvedValueOnce(mockRole);
      mockKnex.update.mockResolvedValueOnce(2); // Delete old permissions
      mockKnex.transaction.mockImplementation((callback) => callback(mockKnex));

      // Act
      const result = await service.updateRolePermissions(roleId, updateDto, 'admin-123');

      // Assert
      expect(result.message).toBe('Role permissions updated successfully');
      expect(mockKnex.insert).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should soft delete role', async () => {
      // Arrange
      const roleId = 'role-123';
      const adminId = 'admin-123';
      const mockRole = RoleFactory.create({ id: roleId });

      mockKnex.first.mockResolvedValueOnce(mockRole);
      mockKnex.count.mockResolvedValueOnce([{ count: '0' }]); // No assigned admins
      mockKnex.update.mockResolvedValueOnce(1);

      // Act
      const result = await service.remove(roleId, adminId);

      // Assert
      expect(result.message).toBe('Role deleted successfully');
      expect(mockKnex.update).toHaveBeenCalledWith({
        deleted_at: expect.any(Date),
        updated_by: adminId,
      });
    });

    it('should not delete role with assigned admins', async () => {
      // Arrange
      const roleId = 'role-123';
      const mockRole = RoleFactory.create({ id: roleId });

      mockKnex.first.mockResolvedValueOnce(mockRole);
      mockKnex.count.mockResolvedValueOnce([{ count: '2' }]); // Has assigned admins

      // Act & Assert
      await expect(service.remove(roleId, 'admin-123')).rejects.toThrow(
        'Cannot delete role with assigned admins',
      );
    });

    it('should invalidate cache after deletion', async () => {
      // Arrange
      const roleId = 'role-123';
      const mockRole = RoleFactory.create({ id: roleId });

      mockKnex.first.mockResolvedValueOnce(mockRole);
      mockKnex.count.mockResolvedValueOnce([{ count: '0' }]);
      mockKnex.update.mockResolvedValueOnce(1);
      mockRedis.keys.mockResolvedValueOnce(['roles:all']);

      // Act
      await service.remove(roleId, 'admin-123');

      // Assert
      expect(mockRedis.del).toHaveBeenCalledWith(['roles:all']);
    });
  });

  describe('getAdminsByRole', () => {
    it('should retrieve admins for a role', async () => {
      // Arrange
      const roleId = 'role-123';
      const mockAdmins = AdminFactory.createMany(2);

      mockKnex.first.mockResolvedValueOnce(mockAdmins);

      // Act
      const result = await service.getAdminsByRole(roleId);

      // Assert
      expect(result.data).toEqual(mockAdmins);
      expect(mockKnex.where).toHaveBeenCalledWith('admins.role_id', roleId);
    });
  });

  describe('getRoleStats', () => {
    it('should return role statistics', async () => {
      // Arrange
      const mockStats = {
        total_roles: 5,
        roles_with_admins: 3,
        total_admin_assignments: 10,
      };

      mockKnex.raw.mockResolvedValueOnce({ rows: [mockStats] });

      // Act
      const result = await service.getRoleStats();

      // Assert
      expect(result.data.total_roles).toBe(5);
      expect(result.data.roles_with_admins).toBe(3);
      expect(result.data.total_admin_assignments).toBe(10);
    });

    it('should cache statistics', async () => {
      // Arrange
      const mockStats = { total_roles: 5 };

      mockRedis.get.mockResolvedValueOnce(null);
      mockKnex.raw.mockResolvedValueOnce({ rows: [mockStats] });

      // Act
      await service.getRoleStats();

      // Assert
      expect(mockRedis.set).toHaveBeenCalledWith('roles:stats', expect.any(String), 'EX', 1800);
    });
  });

  describe('cloneRole', () => {
    it('should clone role with permissions', async () => {
      // Arrange
      const sourceRoleId = 'source-role-123';
      const newRoleName = 'Cloned Role';
      const adminId = 'admin-123';
      const mockSourceRole = RoleFactory.create({ id: sourceRoleId });
      const mockPermissions = PermissionFactory.createMany(2);
      const mockNewRoleId = ['new-role-123'];

      mockKnex.first
        .mockResolvedValueOnce(mockSourceRole)
        .mockResolvedValueOnce(null) // No duplicate name
        .mockResolvedValueOnce(mockPermissions);
      mockKnex.insert.mockResolvedValueOnce(mockNewRoleId).mockResolvedValueOnce(['rp1', 'rp2']);
      mockKnex.transaction.mockImplementation((callback) => callback(mockKnex));

      // Act
      const result = await service.cloneRole(sourceRoleId, newRoleName, adminId);

      // Assert
      expect(result.message).toBe('Role cloned successfully');
      expect(result.role_id).toBe(mockNewRoleId[0]);
      expect(mockKnex.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          role_id: mockNewRoleId[0],
          permission_id: mockPermissions[0].id,
        }),
        expect.objectContaining({
          role_id: mockNewRoleId[0],
          permission_id: mockPermissions[1].id,
        }),
      ]);
    });

    it('should not clone non-existent role', async () => {
      // Arrange
      mockKnex.first.mockResolvedValueOnce(null);

      // Act & Assert
      await expect(service.cloneRole('non-existent-id', 'New Role', 'admin-123')).rejects.toThrow(
        'Source role not found',
      );
    });
  });

  describe('getRolePermissionsCount', () => {
    it('should return count of permissions per role', async () => {
      // Arrange
      const mockCounts = [
        { role_id: 'role-1', role_name: 'Admin', permission_count: '5' },
        { role_id: 'role-2', role_name: 'User', permission_count: '2' },
      ];

      mockKnex.raw.mockResolvedValueOnce({ rows: mockCounts });

      // Act
      const result = await service.getRolePermissionsCount();

      // Assert
      expect(result.data).toHaveLength(2);
      expect(result.data[0].permission_count).toBe(5);
      expect(result.data[1].permission_count).toBe(2);
    });
  });

  describe('validateRoleHierarchy', () => {
    it('should validate role hierarchy for assignment', async () => {
      // Arrange
      const assignerRoleId = 'admin-role';
      const assigneeRoleId = 'user-role';
      const mockAssignerRole = RoleFactory.create({
        id: assignerRoleId,
        hierarchy_level: 1,
      });
      const mockAssigneeRole = RoleFactory.create({
        id: assigneeRoleId,
        hierarchy_level: 3,
      });

      mockKnex.first
        .mockResolvedValueOnce(mockAssignerRole)
        .mockResolvedValueOnce(mockAssigneeRole);

      // Act
      const result = await service.validateRoleHierarchy(assignerRoleId, assigneeRoleId);

      // Assert
      expect(result).toBe(true);
    });

    it('should reject invalid hierarchy assignment', async () => {
      // Arrange
      const assignerRoleId = 'user-role';
      const assigneeRoleId = 'admin-role';
      const mockAssignerRole = RoleFactory.create({
        id: assignerRoleId,
        hierarchy_level: 3,
      });
      const mockAssigneeRole = RoleFactory.create({
        id: assigneeRoleId,
        hierarchy_level: 1,
      });

      mockKnex.first
        .mockResolvedValueOnce(mockAssignerRole)
        .mockResolvedValueOnce(mockAssigneeRole);

      // Act
      const result = await service.validateRoleHierarchy(assignerRoleId, assigneeRoleId);

      // Assert
      expect(result).toBe(false);
    });
  });
});
