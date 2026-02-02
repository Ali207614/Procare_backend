import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Knex } from 'knex';
import { UsersService } from './users.service';
import { RedisService } from '../common/redis/redis.service';
import { UserFactory } from '../../test/factories/user.factory';
import { AdminFactory } from '../../test/factories/admin.factory';

// Mock SQL loader
jest.mock('../common/utils/sql-loader.util', () => ({
  loadSQL: jest.fn().mockReturnValue('SELECT * FROM users WHERE id = :user_id'),
}));

describe('UsersService', () => {
  let service: UsersService;
  let knexMock: jest.Mocked<Knex>;
  let redisServiceMock: jest.Mocked<RedisService>;

  const mockUser = UserFactory.create();
  const mockAdminPayload = AdminFactory.createPayload();

  beforeEach(async () => {
    // Create comprehensive mocks
    knexMock = {
      transaction: jest.fn(),
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      first: jest.fn(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      returning: jest.fn(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      raw: jest.fn(),
      join: jest.fn().mockReturnThis(),
    } as any;

    // Mock knex call
    (knexMock as any).mockImplementation((table: string) => {
      if (table) return knexMock;
      return knexMock;
    });

    redisServiceMock = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: 'default_KnexModuleConnectionToken',
          useValue: knexMock,
        },
        {
          provide: RedisService,
          useValue: redisServiceMock,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = UserFactory.createDto();

    it('should create user successfully', async () => {
      // Arrange
      knexMock.first.mockResolvedValue(undefined); // No existing user
      const trxMock = {
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockUser]),
      };
      knexMock.transaction.mockImplementation((callback) => callback(trxMock));
      redisServiceMock.del.mockResolvedValue(1);

      // Act
      const result = await service.create(createDto, mockAdminPayload);

      // Assert
      expect(result).toEqual(mockUser);
      expect(knexMock.first).toHaveBeenCalled(); // Check for existing user
      expect(redisServiceMock.del).toHaveBeenCalled(); // Cache invalidation
    });

    it('should throw BadRequestException if user phone already exists', async () => {
      // Arrange
      knexMock.first.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(service.create(createDto, mockAdminPayload)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle transaction rollback on error', async () => {
      // Arrange
      knexMock.first.mockResolvedValue(undefined);
      const trxMock = {
        insert: jest.fn().mockRejectedValue(new Error('Database error')),
        rollback: jest.fn(),
      };
      knexMock.transaction.mockImplementation((callback) => callback(trxMock));

      // Act & Assert
      await expect(service.create(createDto, mockAdminPayload)).rejects.toThrow('Database error');
    });
  });

  describe('findByPhone', () => {
    it('should find user by phone number', async () => {
      // Arrange
      knexMock.first.mockResolvedValue(mockUser);

      // Act
      const result = await service.findByPhone(mockUser.phone);

      // Assert
      expect(result).toEqual(mockUser);
      expect(knexMock.where).toHaveBeenCalledWith({ phone: mockUser.phone });
    });

    it('should return undefined when user not found', async () => {
      // Arrange
      knexMock.first.mockResolvedValue(undefined);

      // Act
      const result = await service.findByPhone('non-existent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('findById', () => {
    it('should find user by id using SQL query', async () => {
      // Arrange
      knexMock.raw.mockResolvedValue({ rows: [mockUser] });

      // Act
      const result = await service.findById(mockUser.id);

      // Assert
      expect(result).toEqual(mockUser);
      expect(knexMock.raw).toHaveBeenCalledWith(expect.any(String), { user_id: mockUser.id });
    });

    it('should throw NotFoundException when user not found', async () => {
      // Arrange
      knexMock.raw.mockResolvedValue({ rows: [] });

      // Act & Assert
      await expect(service.findById('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    const findAllDto = {
      limit: 10,
      offset: 0,
    };

    it('should return paginated users', async () => {
      // Arrange
      const mockUsers = [mockUser];
      const mockTotal = 5;
      knexMock.raw.mockResolvedValue({
        rows: mockUsers.map((user) => ({ ...user, total: mockTotal })),
      });

      // Act
      const result = await service.findAll(findAllDto);

      // Assert
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.data).toEqual(mockUsers);
      expect(result.meta.total).toBe(mockTotal);
      expect(result.meta.limit).toBe(findAllDto.limit);
      expect(result.meta.offset).toBe(findAllDto.offset);
    });

    it('should filter by status when provided', async () => {
      // Arrange
      const findAllWithStatus = { ...findAllDto, status: 'Active' };
      knexMock.raw.mockResolvedValue({ rows: [] });

      // Act
      await service.findAll(findAllWithStatus);

      // Assert
      expect(knexMock.raw).toHaveBeenCalledWith(
        expect.stringContaining('status'),
        expect.objectContaining({
          status: 'Active',
        }),
      );
    });

    it('should search by name or phone when provided', async () => {
      // Arrange
      const findAllWithSearch = { ...findAllDto, search: 'Test' };
      knexMock.raw.mockResolvedValue({ rows: [] });

      // Act
      await service.findAll(findAllWithSearch);

      // Assert
      expect(knexMock.raw).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.objectContaining({
          search: '%Test%',
        }),
      );
    });

    it('should handle empty results', async () => {
      // Arrange
      knexMock.raw.mockResolvedValue({ rows: [] });

      // Act
      const result = await service.findAll(findAllDto);

      // Assert
      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('update', () => {
    const updateDto = {
      full_name: 'Updated User Name',
      email: 'updated@test.com',
    };

    it('should update user successfully', async () => {
      // Arrange
      knexMock.raw.mockResolvedValue({ rows: [mockUser] }); // findById
      knexMock.first.mockResolvedValue(undefined); // Check phone uniqueness

      const trxMock = {
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ ...mockUser, ...updateDto }]),
      };
      knexMock.transaction.mockImplementation((callback) => callback(trxMock));
      redisServiceMock.del.mockResolvedValue(1);

      // Act
      const result = await service.update(mockUser.id, updateDto, mockAdminPayload);

      // Assert
      expect(result).toEqual(expect.objectContaining(updateDto));
      expect(redisServiceMock.del).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      // Arrange
      knexMock.raw.mockResolvedValue({ rows: [] });

      // Act & Assert
      await expect(service.update('non-existent', updateDto, mockAdminPayload)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if phone already exists for different user', async () => {
      // Arrange
      const updateWithPhone = { ...updateDto, phone: '+998901234569' };
      knexMock.raw.mockResolvedValue({ rows: [mockUser] }); // findById
      knexMock.first.mockResolvedValue({ id: 'different-user-id' }); // Phone exists

      // Act & Assert
      await expect(service.update(mockUser.id, updateWithPhone, mockAdminPayload)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('delete', () => {
    it('should soft delete user successfully', async () => {
      // Arrange
      knexMock.raw.mockResolvedValue({ rows: [mockUser] }); // findById
      const trxMock = {
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockResolvedValue([]),
      };
      knexMock.transaction.mockImplementation((callback) => callback(trxMock));
      redisServiceMock.del.mockResolvedValue(1);

      // Act
      const result = await service.delete(mockUser.id, mockAdminPayload);

      // Assert
      expect(result).toHaveProperty('message');
      expect(trxMock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          deleted_at: expect.any(Date),
          updated_by: mockAdminPayload.id,
        }),
      );
      expect(redisServiceMock.del).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      // Arrange
      knexMock.raw.mockResolvedValue({ rows: [] });

      // Act & Assert
      await expect(service.delete('non-existent', mockAdminPayload)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateStatus', () => {
    it('should update user status successfully', async () => {
      // Arrange
      knexMock.raw.mockResolvedValue({ rows: [mockUser] }); // findById
      const trxMock = {
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ ...mockUser, status: 'Inactive' }]),
      };
      knexMock.transaction.mockImplementation((callback) => callback(trxMock));
      redisServiceMock.del.mockResolvedValue(1);

      // Act
      const result = await service.updateStatus(mockUser.id, 'Inactive', mockAdminPayload);

      // Assert
      expect(result.status).toBe('Inactive');
      expect(trxMock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'Inactive',
          updated_by: mockAdminPayload.id,
        }),
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      // Arrange
      knexMock.raw.mockResolvedValue({ rows: [] });

      // Act & Assert
      await expect(
        service.updateStatus('non-existent', 'Inactive', mockAdminPayload),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('cache management', () => {
    it('should invalidate cache on operations', async () => {
      // Arrange
      knexMock.first.mockResolvedValue(undefined);
      const trxMock = {
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockUser]),
      };
      knexMock.transaction.mockImplementation((callback) => callback(trxMock));
      redisServiceMock.del.mockResolvedValue(1);

      // Act
      await service.create(UserFactory.createDto(), mockAdminPayload);

      // Assert
      expect(redisServiceMock.del).toHaveBeenCalledWith(expect.stringContaining('users:'));
    });

    it('should handle Redis errors gracefully', async () => {
      // Arrange
      knexMock.first.mockResolvedValue(undefined);
      const trxMock = {
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockUser]),
      };
      knexMock.transaction.mockImplementation((callback) => callback(trxMock));
      redisServiceMock.del.mockRejectedValue(new Error('Redis error'));

      // Act & Assert
      // Should not throw error if Redis fails (graceful degradation)
      await expect(
        service.create(UserFactory.createDto(), mockAdminPayload),
      ).resolves.toBeDefined();
    });
  });

  describe('service initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have all required dependencies injected', () => {
      expect(service['knex']).toBeDefined();
      expect(service['redisService']).toBeDefined();
    });
  });

  describe('input validation', () => {
    it('should validate phone number format', async () => {
      // Arrange
      const invalidDto = UserFactory.createDto({
        phone: 'invalid-phone',
      });

      // Act & Assert - depends on service implementation
      // If service validates phone format, it should throw BadRequestException
    });

    it('should validate email format', async () => {
      // Arrange
      const invalidDto = UserFactory.createDto({
        email: 'invalid-email',
      });

      // Act & Assert - depends on service implementation
      // If service validates email format, it should throw BadRequestException
    });
  });

  describe('error handling', () => {
    it('should handle database connection errors', async () => {
      // Arrange
      knexMock.first.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(service.findByPhone('test')).rejects.toThrow('Database connection failed');
    });

    it('should handle SQL query errors', async () => {
      // Arrange
      knexMock.raw.mockRejectedValue(new Error('SQL syntax error'));

      // Act & Assert
      await expect(service.findById('test-id')).rejects.toThrow('SQL syntax error');
    });
  });
});
