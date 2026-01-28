import { Test, TestingModule } from '@nestjs/testing';
import { AdminsService } from '../../src/admins.service';
import { Knex } from 'knex';
import { getKnexToken } from 'nestjs-knex';
import { RedisService } from '../../src/common/redis/redis.service';
import { PermissionsService } from '../../src/permissions/permissions.service';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreateAdminDto } from '../../src/dto/create-admin.dto';
import { UpdateAdminDto } from '../../src/dto/update-admin.dto';
import { ChangePasswordDto } from '../../src/dto/change-password.dto';
import { AdminPayload } from '../../src/common/types/admin-payload.interface';
import { Admin } from '../../src/common/types/admin.interface';
import bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AdminsService', () => {
  let service: AdminsService;
  let knexMock: jest.Mocked<Knex>;
  let redisMock: jest.Mocked<RedisService>;
  let permissionsServiceMock: jest.Mocked<PermissionsService>;

  const mockAdmin: Admin = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    phone_number: '+998901234567',
    password: 'hashedPassword',
    full_name: 'Test Admin',
    branch_id: '660e8400-e29b-41d4-a716-446655440001',
    status: 'Active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockAdminPayload: AdminPayload = {
    id: mockAdmin.id,
    phone: mockAdmin.phone_number,
    full_name: mockAdmin.full_name,
    roles: ['admin-role-id'],
  };

  beforeEach(async () => {
    const mockQueryBuilder: any = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      whereNotNull: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      first: jest.fn(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      del: jest.fn(),
      returning: jest.fn(),
      join: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      count: jest.fn(),
      raw: jest.fn(),
      clone: jest.fn().mockReturnThis(),
    };

    const mockTransaction: any = {
      ...mockQueryBuilder,
      commit: jest.fn(),
      rollback: jest.fn(),
    };

    knexMock = {
      transaction: jest.fn().mockResolvedValue(mockTransaction),
      raw: jest.fn(),
      ...mockQueryBuilder,
    } as any;

    // Setup transaction to return itself when called with a function
    knexMock.transaction.mockImplementation((callback?: any) => {
      if (typeof callback === 'function') {
        return callback(mockTransaction);
      }
      return Promise.resolve(mockTransaction);
    });

    redisMock = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      flushByPrefix: jest.fn(),
    } as any;

    permissionsServiceMock = {
      getPermissions: jest.fn(),
      clearPermissionCache: jest.fn(),
      findAll: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminsService,
        {
          provide: getKnexToken(),
          useValue: knexMock,
        },
        {
          provide: RedisService,
          useValue: redisMock,
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
    it('should return admin by phone number', async () => {
      // Arrange
      knexMock.where.mockReturnValue(knexMock);
      knexMock.first.mockResolvedValue(mockAdmin);

      // Act
      const result = await service.findByPhoneNumber('+998901234567');

      // Assert
      expect(result).toEqual(mockAdmin);
      expect(knexMock.where).toHaveBeenCalledWith({ phone_number: '+998901234567' });
    });

    it('should return undefined when admin not found', async () => {
      // Arrange
      knexMock.where.mockReturnValue(knexMock);
      knexMock.first.mockResolvedValue(undefined);

      // Act
      const result = await service.findByPhoneNumber('+998901234567');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('findById', () => {
    it('should return admin by id', async () => {
      // Arrange
      const mockSQLResult = { rows: [mockAdmin] };
      knexMock.raw.mockResolvedValue(mockSQLResult);

      // Act
      const result = await service.findById(mockAdmin.id);

      // Assert
      expect(result).toEqual(mockAdmin);
      expect(knexMock.raw).toHaveBeenCalledWith(
        expect.any(String),
        { admin_id: mockAdmin.id }
      );
    });

    it('should throw NotFoundException when admin not found', async () => {
      // Arrange
      const mockSQLResult = { rows: [] };
      knexMock.raw.mockResolvedValue(mockSQLResult);

      // Act & Assert
      await expect(service.findById('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const createDto: CreateAdminDto = {
      phone_number: '+998901234568',
      password: 'password123',
      full_name: 'New Admin',
      branch_id: '660e8400-e29b-41d4-a716-446655440001',
      role_ids: ['role-1', 'role-2'],
    };

    beforeEach(() => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
    });

    it('should create a new admin successfully', async () => {
      // Arrange
      const newAdmin = { ...mockAdmin, ...createDto, password: 'hashedPassword' };
      const trxMock = knexMock.transaction() as any;

      trxMock.where.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValue(null); // Phone not exists
      trxMock.insert.mockReturnValue(trxMock);
      trxMock.returning.mockResolvedValue([newAdmin]);

      // Act
      const result = await service.create(createDto, mockAdminPayload);

      // Assert
      expect(result).toEqual(newAdmin);
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12);
      expect(redisMock.flushByPrefix).toHaveBeenCalledWith('admin');
    });

    it('should throw BadRequestException when phone number already exists', async () => {
      // Arrange
      const trxMock = knexMock.transaction() as any;
      trxMock.where.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValue(mockAdmin); // Phone exists

      // Act & Assert
      await expect(service.create(createDto, mockAdminPayload)).rejects.toThrow(BadRequestException);
      expect(trxMock.rollback).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      // Arrange
      const trxMock = knexMock.transaction() as any;
      trxMock.where.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValue(null);
      trxMock.insert.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.create(createDto, mockAdminPayload)).rejects.toThrow();
      expect(trxMock.rollback).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const updateDto: UpdateAdminDto = {
      full_name: 'Updated Admin',
      status: 'Inactive',
    };

    it('should update admin successfully', async () => {
      // Arrange
      const updatedAdmin = { ...mockAdmin, ...updateDto };
      const trxMock = knexMock.transaction() as any;

      trxMock.where.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValue(mockAdmin);
      trxMock.update.mockReturnValue(trxMock);
      trxMock.returning.mockResolvedValue([updatedAdmin]);

      // Act
      const result = await service.update(mockAdmin.id, updateDto, mockAdminPayload);

      // Assert
      expect(result.message).toContain('successfully');
      expect(redisMock.flushByPrefix).toHaveBeenCalledWith('admin');
    });

    it('should throw NotFoundException when admin not found', async () => {
      // Arrange
      const trxMock = knexMock.transaction() as any;
      trxMock.where.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update('non-existent-id', updateDto, mockAdminPayload))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when trying to update self status', async () => {
      // Arrange
      const selfUpdateDto = { status: 'Inactive' };
      const trxMock = knexMock.transaction() as any;
      trxMock.where.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValue(mockAdmin);

      // Act & Assert
      await expect(service.update(mockAdmin.id, selfUpdateDto, mockAdminPayload))
        .rejects.toThrow(ForbiddenException);
    });
  });

  describe('changePassword', () => {
    const changePasswordDto: ChangePasswordDto = {
      old_password: 'oldPassword',
      new_password: 'newPassword123',
    };

    it('should change password successfully', async () => {
      // Arrange
      knexMock.where.mockReturnValue(knexMock);
      knexMock.first.mockResolvedValue(mockAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('newHashedPassword');
      knexMock.update.mockResolvedValue(1);

      // Act
      const result = await service.changePassword(mockAdminPayload, changePasswordDto);

      // Assert
      expect(result.message).toContain('successfully');
      expect(bcrypt.compare).toHaveBeenCalledWith('oldPassword', mockAdmin.password);
      expect(bcrypt.hash).toHaveBeenCalledWith('newPassword123', 12);
    });

    it('should throw NotFoundException when admin not found', async () => {
      // Arrange
      knexMock.where.mockReturnValue(knexMock);
      knexMock.first.mockResolvedValue(null);

      // Act & Assert
      await expect(service.changePassword(mockAdminPayload, changePasswordDto))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when old password is incorrect', async () => {
      // Arrange
      knexMock.where.mockReturnValue(knexMock);
      knexMock.first.mockResolvedValue(mockAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(service.changePassword(mockAdminPayload, changePasswordDto))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    const queryDto = {
      limit: 10,
      offset: 0,
      search: 'test',
      sort_by: 'full_name',
      sort_order: 'asc' as const,
    };

    it('should return paginated admins', async () => {
      // Arrange
      const mockAdmins = [mockAdmin];
      const mockCountResult = { rows: [{ count: '1' }] };

      knexMock.raw.mockResolvedValueOnce({ rows: mockAdmins });
      knexMock.raw.mockResolvedValueOnce(mockCountResult);

      // Act
      const result = await service.findAll(queryDto, mockAdminPayload);

      // Assert
      expect(result.data).toEqual(mockAdmins);
      expect(result.meta.total).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.offset).toBe(0);
    });

    it('should handle search functionality', async () => {
      // Arrange
      knexMock.raw.mockResolvedValueOnce({ rows: [] });
      knexMock.raw.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      // Act
      await service.findAll(queryDto, mockAdminPayload);

      // Assert
      expect(knexMock.raw).toHaveBeenCalledWith(
        expect.stringContaining('test'),
        expect.any(Object)
      );
    });
  });

  describe('softDelete', () => {
    it('should soft delete admin successfully', async () => {
      // Arrange
      const trxMock = knexMock.transaction() as any;
      trxMock.where.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValue(mockAdmin);
      trxMock.update.mockResolvedValue(1);

      // Act
      const result = await service.softDelete(mockAdmin.id, mockAdminPayload);

      // Assert
      expect(result.message).toContain('successfully');
      expect(redisMock.flushByPrefix).toHaveBeenCalledWith('admin');
      expect(permissionsServiceMock.clearPermissionCache).toHaveBeenCalledWith(mockAdmin.id);
    });

    it('should throw NotFoundException when admin not found', async () => {
      // Arrange
      const trxMock = knexMock.transaction() as any;
      trxMock.where.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValue(null);

      // Act & Assert
      await expect(service.softDelete('non-existent-id', mockAdminPayload))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when trying to delete self', async () => {
      // Arrange
      const trxMock = knexMock.transaction() as any;
      trxMock.where.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValue(mockAdmin);

      // Act & Assert
      await expect(service.softDelete(mockAdmin.id, mockAdminPayload))
        .rejects.toThrow(ForbiddenException);
    });
  });

  describe('cache management', () => {
    it('should flush admin cache after operations', async () => {
      // This is tested in individual methods above, but we can test the cache key format
      expect(service['redisKeyByAdminRoles']).toBe('admin_roles');
      expect(service['redisKeyByAdminId']).toBe('admin:branches');
    });
  });

  describe('error handling', () => {
    it('should handle database connection errors', async () => {
      // Arrange
      knexMock.where.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(service.findByPhoneNumber('+998901234567'))
        .rejects.toThrow('Database connection failed');
    });

    it('should handle bcrypt errors during password operations', async () => {
      // Arrange
      (bcrypt.hash as jest.Mock).mockRejectedValue(new Error('Bcrypt error'));

      // Act & Assert
      await expect(service.create({
        phone_number: '+998901234568',
        password: 'password123',
        full_name: 'New Admin',
        branch_id: '660e8400-e29b-41d4-a716-446655440001',
        role_ids: ['role-1'],
      }, mockAdminPayload)).rejects.toThrow();
    });
  });
});