import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Knex } from 'knex';
import * as bcrypt from 'bcrypt';
import { AdminsService } from './admins.service';
import { RedisService } from '../common/redis/redis.service';
import { PermissionsService } from '../permissions/permissions.service';
import { AdminFactory } from '../../test/factories/admin.factory';

// Mock bcrypt
jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

// Mock SQL loader
jest.mock('../common/utils/sql-loader.util', () => ({
  loadSQL: jest.fn().mockReturnValue('SELECT * FROM admins WHERE id = :admin_id'),
}));

describe('AdminsService', () => {
  let service: AdminsService;
  let knexMock: jest.Mocked<Knex>;
  let redisServiceMock: jest.Mocked<RedisService>;
  let permissionsServiceMock: jest.Mocked<PermissionsService>;

  const mockAdmin = AdminFactory.create();
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

    // Mock knex call without arguments to return the mock
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

    permissionsServiceMock = {
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminsService,
        {
          provide: 'default_KnexModuleConnectionToken',
          useValue: knexMock,
        },
        {
          provide: RedisService,
          useValue: redisServiceMock,
        },
        {
          provide: PermissionsService,
          useValue: permissionsServiceMock,
        },
      ],
    }).compile();

    service = module.get<AdminsService>(AdminsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findByPhoneNumber', () => {
    it('should find admin by phone number', async () => {
      // Arrange
      knexMock.first.mockResolvedValue(mockAdmin);

      // Act
      const result = await service.findByPhoneNumber(mockAdmin.phone);

      // Assert
      expect(result).toEqual(mockAdmin);
      expect(knexMock.where).toHaveBeenCalledWith({ phone_number: mockAdmin.phone });
    });

    it('should return undefined when admin not found', async () => {
      // Arrange
      knexMock.first.mockResolvedValue(undefined);

      // Act
      const result = await service.findByPhoneNumber('non-existent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('findById', () => {
    it('should find admin by id using SQL query', async () => {
      // Arrange
      knexMock.raw.mockResolvedValue({ rows: [mockAdmin] });

      // Act
      const result = await service.findById(mockAdmin.id);

      // Assert
      expect(result).toEqual(mockAdmin);
      expect(knexMock.raw).toHaveBeenCalledWith(expect.any(String), { admin_id: mockAdmin.id });
    });

    it('should throw NotFoundException when admin not found', async () => {
      // Arrange
      knexMock.raw.mockResolvedValue({ rows: [] });

      // Act & Assert
      await expect(service.findById('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const createDto = {
      phone_number: '+998901234567',
      full_name: 'Test Admin',
      branch_id: 'branch-id',
      role_id: 'role-id',
    };

    it('should create admin successfully', async () => {
      // Arrange
      knexMock.first.mockResolvedValue(undefined); // Admin doesn't exist
      const trxMock = {
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockAdmin]),
      };
      knexMock.transaction.mockImplementation((callback) => callback(trxMock));
      redisServiceMock.del.mockResolvedValue(1);

      // Act
      const result = await service.create(createDto, mockAdminPayload);

      // Assert
      expect(result).toEqual(mockAdmin);
      expect(knexMock.first).toHaveBeenCalled(); // Check for existing admin
      expect(redisServiceMock.del).toHaveBeenCalled(); // Cache invalidation
    });

    it('should throw BadRequestException if admin already exists', async () => {
      // Arrange
      knexMock.first.mockResolvedValue(mockAdmin);

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

  describe('update', () => {
    const updateDto = {
      full_name: 'Updated Name',
      role_id: 'new-role-id',
    };

    it('should update admin successfully', async () => {
      // Arrange
      knexMock.raw.mockResolvedValue({ rows: [mockAdmin] }); // findById
      const trxMock = {
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ ...mockAdmin, ...updateDto }]),
      };
      knexMock.transaction.mockImplementation((callback) => callback(trxMock));
      redisServiceMock.del.mockResolvedValue(1);

      // Act
      const result = await service.update(mockAdmin.id, updateDto, mockAdminPayload);

      // Assert
      expect(result).toEqual(expect.objectContaining(updateDto));
      expect(redisServiceMock.del).toHaveBeenCalled();
    });

    it('should throw NotFoundException if admin not found', async () => {
      // Arrange
      knexMock.raw.mockResolvedValue({ rows: [] });

      // Act & Assert
      await expect(service.update('non-existent', updateDto, mockAdminPayload)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    const findAllDto = {
      limit: 10,
      offset: 0,
    };

    it('should return paginated admins', async () => {
      // Arrange
      const mockAdmins = [mockAdmin];
      const mockTotal = 5;
      knexMock.raw.mockResolvedValue({
        rows: mockAdmins.map((admin) => ({ ...admin, total: mockTotal })),
      });

      // Act
      const result = await service.findAll(findAllDto);

      // Assert
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.data).toEqual(mockAdmins);
      expect(result.meta.total).toBe(mockTotal);
      expect(result.meta.limit).toBe(findAllDto.limit);
      expect(result.meta.offset).toBe(findAllDto.offset);
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

  describe('delete', () => {
    it('should soft delete admin successfully', async () => {
      // Arrange
      knexMock.raw.mockResolvedValue({ rows: [mockAdmin] }); // findById
      const trxMock = {
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockResolvedValue([]),
      };
      knexMock.transaction.mockImplementation((callback) => callback(trxMock));
      redisServiceMock.del.mockResolvedValue(1);

      // Act
      const result = await service.delete(mockAdmin.id, mockAdminPayload);

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

    it('should prevent self-deletion', async () => {
      // Arrange
      knexMock.raw.mockResolvedValue({ rows: [mockAdmin] });

      // Act & Assert
      await expect(service.delete(mockAdminPayload.id, mockAdminPayload)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('changePassword', () => {
    const changePasswordDto = {
      current_password: 'oldPassword',
      new_password: 'newPassword123',
    };

    it('should change password successfully', async () => {
      // Arrange
      knexMock.raw.mockResolvedValue({ rows: [mockAdmin] }); // findById
      mockedBcrypt.compare.mockResolvedValue(true as never);
      mockedBcrypt.hash.mockResolvedValue('hashedNewPassword' as never);

      const trxMock = {
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockResolvedValue([]),
      };
      knexMock.transaction.mockImplementation((callback) => callback(trxMock));

      // Act
      const result = await service.changePassword(mockAdminPayload.id, changePasswordDto);

      // Assert
      expect(result).toHaveProperty('message');
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        changePasswordDto.current_password,
        mockAdmin.password,
      );
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(changePasswordDto.new_password, 10);
    });

    it('should throw UnauthorizedException for wrong current password', async () => {
      // Arrange
      knexMock.raw.mockResolvedValue({ rows: [mockAdmin] });
      mockedBcrypt.compare.mockResolvedValue(false as never);

      // Act & Assert
      await expect(service.changePassword(mockAdminPayload.id, changePasswordDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('cache management', () => {
    it('should invalidate admin cache on updates', async () => {
      // Arrange
      knexMock.raw.mockResolvedValue({ rows: [mockAdmin] });
      const trxMock = {
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockAdmin]),
      };
      knexMock.transaction.mockImplementation((callback) => callback(trxMock));
      redisServiceMock.del.mockResolvedValue(1);

      // Act
      await service.update(mockAdmin.id, { full_name: 'New Name' }, mockAdminPayload);

      // Assert
      expect(redisServiceMock.del).toHaveBeenCalledWith(expect.stringContaining('admin_roles'));
    });

    it('should handle Redis errors gracefully', async () => {
      // Arrange
      knexMock.raw.mockResolvedValue({ rows: [mockAdmin] });
      const trxMock = {
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockAdmin]),
      };
      knexMock.transaction.mockImplementation((callback) => callback(trxMock));
      redisServiceMock.del.mockRejectedValue(new Error('Redis error'));

      // Act & Assert
      // Should not throw error if Redis fails (graceful degradation)
      await expect(
        service.update(mockAdmin.id, { full_name: 'New Name' }, mockAdminPayload),
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
      expect(service['permissionsService']).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle database connection errors', async () => {
      // Arrange
      knexMock.first.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(service.findByPhoneNumber('test')).rejects.toThrow('Database connection failed');
    });

    it('should handle SQL query errors', async () => {
      // Arrange
      knexMock.raw.mockRejectedValue(new Error('SQL syntax error'));

      // Act & Assert
      await expect(service.findById('test-id')).rejects.toThrow('SQL syntax error');
    });
  });
});
