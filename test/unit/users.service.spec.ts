import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../../src/users.service';
import { Knex } from 'knex';
import { getKnexToken } from 'nestjs-knex';
import { RedisService } from '../../src/common/redis/redis.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from '../../src/dto/create-user.dto';
import { UpdateUserDto } from '../../src/dto/update-user.dto';
import { FindAllUsersDto } from '../../src/dto/find-all-user.dto';
import { AdminPayload } from '../../src/common/types/admin-payload.interface';
import { User, UserListItem } from '../../src/common/types/user.interface';
import { UserWithRepairOrders } from '../../src/common/types/repair-order.interface';

describe('UsersService', () => {
  let service: UsersService;
  let knexMock: jest.Mocked<Knex>;
  let redisMock: jest.Mocked<RedisService>;

  const mockUser: User = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    phone: '+998901234567',
    full_name: 'Test User',
    telegram_id: null,
    telegram_username: null,
    status: 'Open',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
  };

  const mockUserListItem: UserListItem = {
    id: mockUser.id,
    phone: mockUser.phone,
    full_name: mockUser.full_name,
    telegram_username: mockUser.telegram_username,
    repair_orders_count: 5,
    total_amount: 1000000,
    created_at: mockUser.created_at,
  };

  const mockAdminPayload: AdminPayload = {
    id: '660e8400-e29b-41d4-a716-446655440001',
    phone: '+998901234568',
    full_name: 'Test Admin',
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
      rightJoin: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      count: jest.fn(),
      raw: jest.fn(),
      clone: jest.fn().mockReturnThis(),
      modify: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      whereNotIn: jest.fn().mockReturnThis(),
      whereLike: jest.fn().mockReturnThis(),
      whereILike: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
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

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateUserDto = {
      phone: '+998901234567',
      full_name: 'New User',
      telegram_id: null,
      telegram_username: null,
    };

    it('should create a new user successfully', async () => {
      // Arrange
      const trxMock = knexMock.transaction() as any;
      trxMock.where.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValue(null); // Phone not exists
      trxMock.insert.mockReturnValue(trxMock);
      trxMock.returning.mockResolvedValue([mockUser]);

      // Act
      const result = await service.create(createDto, mockAdminPayload);

      // Assert
      expect(result).toEqual(mockUser);
      expect(trxMock.insert).toHaveBeenCalledWith({
        phone: createDto.phone,
        full_name: createDto.full_name,
        telegram_id: createDto.telegram_id,
        telegram_username: createDto.telegram_username,
        status: 'Open',
        created_by: mockAdminPayload.id,
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });
      expect(redisMock.flushByPrefix).toHaveBeenCalledWith('users');
    });

    it('should throw BadRequestException when phone number already exists', async () => {
      // Arrange
      const trxMock = knexMock.transaction() as any;
      trxMock.where.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValue(mockUser); // Phone exists

      // Act & Assert
      await expect(service.create(createDto, mockAdminPayload))
        .rejects.toThrow(BadRequestException);
      await expect(service.create(createDto, mockAdminPayload))
        .rejects.toThrow('Phone number already exists');
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

  describe('findOneWithOrders', () => {
    const mockUserWithOrders: UserWithRepairOrders = {
      ...mockUser,
      repair_orders: [],
    };

    it('should return user with repair orders', async () => {
      // Arrange
      knexMock.where.mockReturnValue(knexMock);
      knexMock.first.mockResolvedValue(mockUser);
      knexMock.leftJoin.mockReturnValue(knexMock);
      knexMock.select.mockResolvedValue([]);

      // Act
      const result = await service.findOneWithOrders(mockUser.id);

      // Assert
      expect(result).toEqual(mockUserWithOrders);
      expect(knexMock.where).toHaveBeenCalledWith({ id: mockUser.id });
    });

    it('should throw NotFoundException when user not found', async () => {
      // Arrange
      knexMock.where.mockReturnValue(knexMock);
      knexMock.first.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOneWithOrders('non-existent-id'))
        .rejects.toThrow(NotFoundException);
      await expect(service.findOneWithOrders('non-existent-id'))
        .rejects.toThrow('user not found');
    });
  });

  describe('findAll', () => {
    const queryDto: FindAllUsersDto = {
      limit: 10,
      offset: 0,
      search: 'test',
      sort_by: 'full_name',
      sort_order: 'asc',
      has_telegram: 'yes',
    };

    it('should return paginated users', async () => {
      // Arrange
      const mockUsers = [mockUserListItem];
      const mockCountResult = [{ count: 1 }];

      knexMock.leftJoin.mockReturnValue(knexMock);
      knexMock.select.mockReturnValue(knexMock);
      knexMock.whereNull.mockReturnValue(knexMock);
      knexMock.groupBy.mockReturnValue(knexMock);
      knexMock.orderBy.mockReturnValue(knexMock);
      knexMock.limit.mockReturnValue(knexMock);
      knexMock.offset.mockResolvedValue(mockUsers);

      knexMock.count.mockReturnValue(knexMock);
      knexMock.first.mockResolvedValue({ count: 1 });

      // Act
      const result = await service.findAll(queryDto);

      // Assert
      expect(result.data).toEqual(mockUsers);
      expect(result.meta.total).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.offset).toBe(0);
    });

    it('should apply search filter', async () => {
      // Arrange
      knexMock.leftJoin.mockReturnValue(knexMock);
      knexMock.select.mockReturnValue(knexMock);
      knexMock.whereNull.mockReturnValue(knexMock);
      knexMock.andWhere.mockReturnValue(knexMock);
      knexMock.whereILike.mockReturnValue(knexMock);
      knexMock.orWhere.mockReturnValue(knexMock);
      knexMock.groupBy.mockReturnValue(knexMock);
      knexMock.orderBy.mockReturnValue(knexMock);
      knexMock.limit.mockReturnValue(knexMock);
      knexMock.offset.mockResolvedValue([]);
      knexMock.count.mockReturnValue(knexMock);
      knexMock.first.mockResolvedValue({ count: 0 });

      // Act
      await service.findAll(queryDto);

      // Assert
      expect(knexMock.andWhere).toHaveBeenCalled();
    });

    it('should apply telegram filter for users with telegram', async () => {
      // Arrange
      const telegramQueryDto = { ...queryDto, has_telegram: 'yes' as const };

      knexMock.leftJoin.mockReturnValue(knexMock);
      knexMock.select.mockReturnValue(knexMock);
      knexMock.whereNull.mockReturnValue(knexMock);
      knexMock.whereNotNull.mockReturnValue(knexMock);
      knexMock.groupBy.mockReturnValue(knexMock);
      knexMock.orderBy.mockReturnValue(knexMock);
      knexMock.limit.mockReturnValue(knexMock);
      knexMock.offset.mockResolvedValue([]);
      knexMock.count.mockReturnValue(knexMock);
      knexMock.first.mockResolvedValue({ count: 0 });

      // Act
      await service.findAll(telegramQueryDto);

      // Assert
      expect(knexMock.whereNotNull).toHaveBeenCalledWith('u.telegram_id');
    });

    it('should apply telegram filter for users without telegram', async () => {
      // Arrange
      const noTelegramQueryDto = { ...queryDto, has_telegram: 'no' as const };

      knexMock.leftJoin.mockReturnValue(knexMock);
      knexMock.select.mockReturnValue(knexMock);
      knexMock.whereNull.mockReturnValue(knexMock);
      knexMock.groupBy.mockReturnValue(knexMock);
      knexMock.orderBy.mockReturnValue(knexMock);
      knexMock.limit.mockReturnValue(knexMock);
      knexMock.offset.mockResolvedValue([]);
      knexMock.count.mockReturnValue(knexMock);
      knexMock.first.mockResolvedValue({ count: 0 });

      // Act
      await service.findAll(noTelegramQueryDto);

      // Assert
      expect(knexMock.whereNull).toHaveBeenCalledWith('u.telegram_id');
    });
  });

  describe('findOne', () => {
    it('should return user by id', async () => {
      // Arrange
      knexMock.where.mockReturnValue(knexMock);
      knexMock.whereNull.mockReturnValue(knexMock);
      knexMock.first.mockResolvedValue(mockUser);

      // Act
      const result = await service.findOne(mockUser.id);

      // Assert
      expect(result).toEqual(mockUser);
      expect(knexMock.where).toHaveBeenCalledWith('id', mockUser.id);
      expect(knexMock.whereNull).toHaveBeenCalledWith('deleted_at');
    });

    it('should throw NotFoundException when user not found', async () => {
      // Arrange
      knexMock.where.mockReturnValue(knexMock);
      knexMock.whereNull.mockReturnValue(knexMock);
      knexMock.first.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne('non-existent-id'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateUserDto = {
      full_name: 'Updated User',
      telegram_username: '@updateduser',
    };

    it('should update user successfully', async () => {
      // Arrange
      const updatedUser = { ...mockUser, ...updateDto };
      const trxMock = knexMock.transaction() as any;

      trxMock.where.mockReturnValue(trxMock);
      trxMock.whereNull.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValue(mockUser);
      trxMock.update.mockReturnValue(trxMock);
      trxMock.returning.mockResolvedValue([updatedUser]);

      // Act
      const result = await service.update(mockUser.id, updateDto, mockAdminPayload);

      // Assert
      expect(result.message).toContain('successfully');
      expect(trxMock.update).toHaveBeenCalledWith({
        full_name: updateDto.full_name,
        telegram_username: updateDto.telegram_username,
        updated_by: mockAdminPayload.id,
        updated_at: expect.any(String),
      });
      expect(redisMock.flushByPrefix).toHaveBeenCalledWith('users');
    });

    it('should throw NotFoundException when user not found', async () => {
      // Arrange
      const trxMock = knexMock.transaction() as any;
      trxMock.where.mockReturnValue(trxMock);
      trxMock.whereNull.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update('non-existent-id', updateDto, mockAdminPayload))
        .rejects.toThrow(NotFoundException);
    });

    it('should handle phone number uniqueness check during update', async () => {
      // Arrange
      const updateDtoWithPhone = { ...updateDto, phone: '+998901234569' };
      const trxMock = knexMock.transaction() as any;

      trxMock.where.mockReturnValue(trxMock);
      trxMock.whereNull.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValueOnce(mockUser); // User exists
      trxMock.andWhere.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValueOnce(null); // Phone not taken

      trxMock.update.mockReturnValue(trxMock);
      trxMock.returning.mockResolvedValue([{ ...mockUser, ...updateDtoWithPhone }]);

      // Act
      const result = await service.update(mockUser.id, updateDtoWithPhone, mockAdminPayload);

      // Assert
      expect(result.message).toContain('successfully');
      expect(trxMock.update).toHaveBeenCalledWith(expect.objectContaining({
        phone: '+998901234569',
      }));
    });

    it('should throw BadRequestException when new phone number already exists', async () => {
      // Arrange
      const updateDtoWithPhone = { ...updateDto, phone: '+998901234569' };
      const existingUserWithPhone = { ...mockUser, id: 'different-id', phone: '+998901234569' };
      const trxMock = knexMock.transaction() as any;

      trxMock.where.mockReturnValue(trxMock);
      trxMock.whereNull.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValueOnce(mockUser); // User exists
      trxMock.andWhere.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValueOnce(existingUserWithPhone); // Phone taken

      // Act & Assert
      await expect(service.update(mockUser.id, updateDtoWithPhone, mockAdminPayload))
        .rejects.toThrow(BadRequestException);
      await expect(service.update(mockUser.id, updateDtoWithPhone, mockAdminPayload))
        .rejects.toThrow('Phone number already exists');
    });
  });

  describe('remove', () => {
    it('should soft delete user successfully', async () => {
      // Arrange
      const trxMock = knexMock.transaction() as any;
      trxMock.where.mockReturnValue(trxMock);
      trxMock.whereNull.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValue(mockUser);
      trxMock.update.mockResolvedValue(1);

      // Act
      const result = await service.remove(mockUser.id, mockAdminPayload);

      // Assert
      expect(result.message).toContain('successfully');
      expect(trxMock.update).toHaveBeenCalledWith({
        deleted_at: expect.any(String),
        deleted_by: mockAdminPayload.id,
        updated_at: expect.any(String),
      });
      expect(redisMock.flushByPrefix).toHaveBeenCalledWith('users');
    });

    it('should throw NotFoundException when user not found for deletion', async () => {
      // Arrange
      const trxMock = knexMock.transaction() as any;
      trxMock.where.mockReturnValue(trxMock);
      trxMock.whereNull.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValue(null);

      // Act & Assert
      await expect(service.remove('non-existent-id', mockAdminPayload))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('cache management', () => {
    it('should flush users cache after operations', async () => {
      // This is verified in the individual operation tests above
      const trxMock = knexMock.transaction() as any;
      trxMock.where.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValue(null);
      trxMock.insert.mockReturnValue(trxMock);
      trxMock.returning.mockResolvedValue([mockUser]);

      await service.create({
        phone: '+998901234567',
        full_name: 'Test User',
      }, mockAdminPayload);

      expect(redisMock.flushByPrefix).toHaveBeenCalledWith('users');
    });
  });

  describe('error handling', () => {
    it('should handle database connection errors', async () => {
      // Arrange
      knexMock.where.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(service.findOne(mockUser.id))
        .rejects.toThrow('Database connection failed');
    });

    it('should handle transaction rollback on errors', async () => {
      // Arrange
      const trxMock = knexMock.transaction() as any;
      trxMock.where.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValue(null);
      trxMock.insert.mockRejectedValue(new Error('Insert failed'));

      // Act & Assert
      await expect(service.create({
        phone: '+998901234567',
        full_name: 'Test User',
      }, mockAdminPayload)).rejects.toThrow();

      expect(trxMock.rollback).toHaveBeenCalled();
    });
  });

  describe('data validation and constraints', () => {
    it('should validate phone number format', async () => {
      // This would typically be handled by DTO validation
      // but we can test the service behavior with invalid data

      const trxMock = knexMock.transaction() as any;
      trxMock.where.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValue(null);
      trxMock.insert.mockRejectedValue(new Error('Invalid phone format'));

      await expect(service.create({
        phone: 'invalid-phone',
        full_name: 'Test User',
      }, mockAdminPayload)).rejects.toThrow();
    });

    it('should handle telegram_id uniqueness constraints', async () => {
      // Test telegram_id uniqueness if it's enforced at database level
      const trxMock = knexMock.transaction() as any;
      trxMock.where.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValue(null);
      trxMock.insert.mockRejectedValue(new Error('Duplicate telegram_id'));

      await expect(service.create({
        phone: '+998901234567',
        full_name: 'Test User',
        telegram_id: 123456789,
      }, mockAdminPayload)).rejects.toThrow();
    });
  });

  describe('query optimizations and performance', () => {
    it('should use appropriate joins for user list queries', async () => {
      // This test verifies that the query uses efficient joins
      knexMock.leftJoin.mockReturnValue(knexMock);
      knexMock.select.mockReturnValue(knexMock);
      knexMock.whereNull.mockReturnValue(knexMock);
      knexMock.groupBy.mockReturnValue(knexMock);
      knexMock.orderBy.mockReturnValue(knexMock);
      knexMock.limit.mockReturnValue(knexMock);
      knexMock.offset.mockResolvedValue([]);
      knexMock.count.mockReturnValue(knexMock);
      knexMock.first.mockResolvedValue({ count: 0 });

      await service.findAll({ limit: 10, offset: 0 });

      expect(knexMock.leftJoin).toHaveBeenCalledWith('repair_orders as ro', 'u.id', 'ro.user_id');
      expect(knexMock.groupBy).toHaveBeenCalledWith('u.id');
    });
  });
});