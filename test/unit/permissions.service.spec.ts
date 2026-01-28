import { Test, TestingModule } from '@nestjs/testing';
import { PermissionsService } from '../../src/permissions.service';
import { Knex } from 'knex';
import { getKnexToken } from 'nestjs-knex';
import { RedisService } from '../../src/common/redis/redis.service';
import { Permission } from '../../src/common/types/permission.interface';

describe('PermissionsService', () => {
  let service: PermissionsService;
  let knexMock: jest.Mocked<Knex>;
  let redisMock: jest.Mocked<RedisService>;

  const mockPermissions: Permission[] = [
    {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'user.create',
      description: 'Create users',
      is_active: true,
      status: 'Open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: '660e8400-e29b-41d4-a716-446655440001',
      name: 'user.view',
      description: 'View users',
      is_active: true,
      status: 'Open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  beforeEach(async () => {
    const mockQueryBuilder: any = {
      select: jest.fn().mockReturnThis(),
      join: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      first: jest.fn(),
    };

    knexMock = {
      ...mockQueryBuilder,
    } as any;

    redisMock = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      flushByPrefix: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        {
          provide: getKnexToken(),
          useValue: knexMock,
        },
        {
          provide: RedisService,
          useValue: redisMock,
        },
      ],
    }).compile();

    service = module.get<PermissionsService>(PermissionsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPermissions', () => {
    const adminId = '550e8400-e29b-41d4-a716-446655440000';

    it('should return cached permissions if available', async () => {
      // Arrange
      const cachedPermissions = ['user.create', 'user.view'];
      redisMock.get.mockResolvedValue(cachedPermissions);

      // Act
      const result = await service.getPermissions(adminId);

      // Assert
      expect(result).toEqual(cachedPermissions);
      expect(redisMock.get).toHaveBeenCalledWith(`admin:${adminId}:permissions`);
      expect(knexMock.join).not.toHaveBeenCalled();
    });

    it('should load permissions from database when not cached', async () => {
      // Arrange
      redisMock.get.mockResolvedValue(null);
      knexMock.join.mockReturnValue(knexMock);
      knexMock.where.mockReturnValue(knexMock);
      knexMock.andWhere.mockReturnValue(knexMock);
      knexMock.select.mockReturnValue(knexMock);
      knexMock.groupBy.mockResolvedValue([
        { name: 'user.create' },
        { name: 'user.view' },
      ]);

      // Act
      const result = await service.getPermissions(adminId);

      // Assert
      expect(result).toEqual(['user.create', 'user.view']);
      expect(redisMock.set).toHaveBeenCalledWith(
        `admin:${adminId}:permissions`,
        ['user.create', 'user.view'],
        300
      );
    });

    it('should handle empty permissions from database', async () => {
      // Arrange
      redisMock.get.mockResolvedValue(null);
      knexMock.join.mockReturnValue(knexMock);
      knexMock.where.mockReturnValue(knexMock);
      knexMock.andWhere.mockReturnValue(knexMock);
      knexMock.select.mockReturnValue(knexMock);
      knexMock.groupBy.mockResolvedValue([]);

      // Act
      const result = await service.getPermissions(adminId);

      // Assert
      expect(result).toEqual([]);
      expect(redisMock.set).toHaveBeenCalledWith(
        `admin:${adminId}:permissions`,
        [],
        300
      );
    });
  });

  describe('clearPermissionCache', () => {
    it('should clear permission cache for admin', async () => {
      // Arrange
      const adminId = '550e8400-e29b-41d4-a716-446655440000';

      // Act
      await service.clearPermissionCache(adminId);

      // Assert
      expect(redisMock.del).toHaveBeenCalledWith(`admin:${adminId}:permissions`);
    });
  });

  describe('findAll', () => {
    const query = {
      search: 'user',
      limit: 10,
      offset: 0,
      sort_by: 'name',
      sort_order: 'asc' as const,
    };

    it('should return permissions with search filter', async () => {
      // Arrange
      knexMock.where.mockReturnValue(knexMock);
      knexMock.andWhere.mockReturnValue(knexMock);
      knexMock.orderBy.mockReturnValue(knexMock);
      knexMock.limit.mockReturnValue(knexMock);
      knexMock.offset.mockReturnValue(knexMock);
      knexMock.select.mockResolvedValue(mockPermissions);

      // Act
      const result = await service.findAll(query);

      // Assert
      expect(result).toEqual(mockPermissions);
      expect(knexMock.where).toHaveBeenCalledWith('is_active', true);
      expect(knexMock.andWhere).toHaveBeenCalledWith('status', 'Open');
      expect(knexMock.limit).toHaveBeenCalledWith(10);
      expect(knexMock.offset).toHaveBeenCalledWith(0);
    });

    it('should return permissions without search filter', async () => {
      // Arrange
      const queryWithoutSearch = { ...query, search: undefined };
      knexMock.where.mockReturnValue(knexMock);
      knexMock.andWhere.mockReturnValue(knexMock);
      knexMock.orderBy.mockReturnValue(knexMock);
      knexMock.limit.mockReturnValue(knexMock);
      knexMock.offset.mockReturnValue(knexMock);
      knexMock.select.mockResolvedValue(mockPermissions);

      // Act
      const result = await service.findAll(queryWithoutSearch);

      // Assert
      expect(result).toEqual(mockPermissions);
      expect(knexMock.where).toHaveBeenCalledWith('is_active', true);
      expect(knexMock.andWhere).toHaveBeenCalledWith('status', 'Open');
    });

    it('should apply search filter when provided', async () => {
      // Arrange
      const searchQuery = { ...query, search: 'create' };
      knexMock.where.mockReturnValue(knexMock);
      knexMock.andWhere.mockReturnValue(knexMock);
      knexMock.orderBy.mockReturnValue(knexMock);
      knexMock.limit.mockReturnValue(knexMock);
      knexMock.offset.mockReturnValue(knexMock);
      knexMock.select.mockResolvedValue([mockPermissions[0]]);

      // Act
      const result = await service.findAll(searchQuery);

      // Assert
      expect(result).toEqual([mockPermissions[0]]);
      expect(knexMock.andWhere).toHaveBeenCalled();
    });
  });

  describe('cache key generation', () => {
    it('should generate correct cache key', () => {
      // Arrange
      const adminId = 'test-admin-id';
      const expectedKey = `admin:${adminId}:permissions`;

      // Act
      const key = service['getCacheKey'](adminId);

      // Assert
      expect(key).toBe(expectedKey);
    });
  });

  describe('database query structure', () => {
    it('should use correct joins for permission lookup', async () => {
      // Arrange
      const adminId = '550e8400-e29b-41d4-a716-446655440000';
      redisMock.get.mockResolvedValue(null);
      knexMock.join.mockReturnValue(knexMock);
      knexMock.where.mockReturnValue(knexMock);
      knexMock.andWhere.mockReturnValue(knexMock);
      knexMock.select.mockReturnValue(knexMock);
      knexMock.groupBy.mockResolvedValue([]);

      // Act
      await service.getPermissions(adminId);

      // Assert
      expect(knexMock.join).toHaveBeenCalledWith('roles as r', 'r.id', 'ar.role_id');
      expect(knexMock.join).toHaveBeenCalledWith('role_permissions as rp', 'rp.role_id', 'r.id');
      expect(knexMock.join).toHaveBeenCalledWith('permissions as p', 'p.id', 'rp.permission_id');
    });
  });

  describe('error handling', () => {
    it('should handle database errors during permission lookup', async () => {
      // Arrange
      const adminId = '550e8400-e29b-41d4-a716-446655440000';
      redisMock.get.mockResolvedValue(null);
      knexMock.join.mockReturnValue(knexMock);
      knexMock.where.mockReturnValue(knexMock);
      knexMock.andWhere.mockReturnValue(knexMock);
      knexMock.select.mockReturnValue(knexMock);
      knexMock.groupBy.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.getPermissions(adminId)).rejects.toThrow('Database error');
    });

    it('should handle redis errors during cache operations', async () => {
      // Arrange
      const adminId = '550e8400-e29b-41d4-a716-446655440000';
      redisMock.get.mockRejectedValue(new Error('Redis error'));

      // Act & Assert
      await expect(service.getPermissions(adminId)).rejects.toThrow('Redis error');
    });
  });
});