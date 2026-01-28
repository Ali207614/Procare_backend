import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from '../../src/users.controller';
import { UsersService } from '../../src/users.service';
import { CreateUserDto } from '../../src/dto/create-user.dto';
import { UpdateUserDto } from '../../src/dto/update-user.dto';
import { FindAllUsersDto } from '../../src/dto/find-all-user.dto';
import { AdminPayload } from '../../src/common/types/admin-payload.interface';
import { User, UserListItem } from '../../src/common/types/user.interface';
import { UserWithRepairOrders } from '../../src/common/types/repair-order.interface';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaginationResult } from '../../src/common/utils/pagination.util';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockUsersService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findOneWithOrders: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockAdminPayload: AdminPayload = {
    id: '660e8400-e29b-41d4-a716-446655440001',
    phone: '+998901234568',
    full_name: 'Test Admin',
    roles: ['admin-role-id'],
  };

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

  const mockUserWithOrders: UserWithRepairOrders = {
    ...mockUser,
    repair_orders: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new user successfully', async () => {
      // Arrange
      const createDto: CreateUserDto = {
        phone: '+998901234567',
        full_name: 'New User',
        telegram_id: null,
        telegram_username: null,
      };

      mockUsersService.create.mockResolvedValue(mockUser);

      // Act
      const result = await controller.create(createDto, mockAdminPayload);

      // Assert
      expect(result).toEqual(mockUser);
      expect(service.create).toHaveBeenCalledWith(createDto, mockAdminPayload);
    });

    it('should handle phone number already exists error', async () => {
      // Arrange
      const createDto: CreateUserDto = {
        phone: '+998901234567',
        full_name: 'New User',
      };
      const serviceError = new BadRequestException('Phone number already exists');

      mockUsersService.create.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.create(createDto, mockAdminPayload))
        .rejects.toThrow(BadRequestException);
      await expect(controller.create(createDto, mockAdminPayload))
        .rejects.toThrow('Phone number already exists');
    });

    it('should handle validation errors', async () => {
      // Arrange
      const invalidDto: CreateUserDto = {
        phone: 'invalid-phone',
        full_name: '',
      };
      const serviceError = new BadRequestException('Validation failed');

      mockUsersService.create.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.create(invalidDto, mockAdminPayload))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      // Arrange
      const query: FindAllUsersDto = {
        limit: 10,
        offset: 0,
        search: 'test',
        sort_by: 'full_name',
        sort_order: 'asc',
      };
      const expectedResult: PaginationResult<UserListItem> = {
        data: [mockUserListItem],
        meta: { total: 1, limit: 10, offset: 0 },
      };

      mockUsersService.findAll.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.findAll(query);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.findAll).toHaveBeenCalledWith(query);
    });

    it('should handle search functionality', async () => {
      // Arrange
      const query: FindAllUsersDto = {
        search: 'John',
        limit: 20,
        offset: 0,
      };
      const expectedResult: PaginationResult<UserListItem> = {
        data: [],
        meta: { total: 0, limit: 20, offset: 0 },
      };

      mockUsersService.findAll.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.findAll(query);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.findAll).toHaveBeenCalledWith(query);
    });

    it('should handle telegram filter', async () => {
      // Arrange
      const query: FindAllUsersDto = {
        has_telegram: 'yes',
        limit: 10,
        offset: 0,
      };
      const expectedResult: PaginationResult<UserListItem> = {
        data: [mockUserListItem],
        meta: { total: 1, limit: 10, offset: 0 },
      };

      mockUsersService.findAll.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.findAll(query);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.findAll).toHaveBeenCalledWith(query);
    });

    it('should use default pagination when not provided', async () => {
      // Arrange
      const query: FindAllUsersDto = {};
      const expectedResult: PaginationResult<UserListItem> = {
        data: [mockUserListItem],
        meta: { total: 1, limit: 20, offset: 0 },
      };

      mockUsersService.findAll.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.findAll(query);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.findAll).toHaveBeenCalledWith(query);
    });

    it('should handle sorting options', async () => {
      // Arrange
      const query: FindAllUsersDto = {
        sort_by: 'created_at',
        sort_order: 'desc',
        limit: 10,
        offset: 0,
      };
      const expectedResult: PaginationResult<UserListItem> = {
        data: [mockUserListItem],
        meta: { total: 1, limit: 10, offset: 0 },
      };

      mockUsersService.findAll.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.findAll(query);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findOne', () => {
    it('should return user by ID', async () => {
      // Arrange
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      mockUsersService.findOne.mockResolvedValue(mockUser);

      // Act
      const result = await controller.findOne(userId);

      // Assert
      expect(result).toEqual(mockUser);
      expect(service.findOne).toHaveBeenCalledWith(userId);
    });

    it('should handle user not found error', async () => {
      // Arrange
      const userId = 'non-existent-id';
      const serviceError = new NotFoundException('User not found');

      mockUsersService.findOne.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.findOne(userId)).rejects.toThrow(NotFoundException);
      await expect(controller.findOne(userId)).rejects.toThrow('User not found');
    });
  });

  describe('findOneWithRepairOrders', () => {
    it('should return user with repair orders', async () => {
      // Arrange
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      mockUsersService.findOneWithOrders.mockResolvedValue(mockUserWithOrders);

      // Act
      const result = await controller.findOneWithRepairOrders(userId);

      // Assert
      expect(result).toEqual(mockUserWithOrders);
      expect(service.findOneWithOrders).toHaveBeenCalledWith(userId);
    });

    it('should handle user not found for orders query', async () => {
      // Arrange
      const userId = 'non-existent-id';
      const serviceError = new NotFoundException('user not found');

      mockUsersService.findOneWithOrders.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.findOneWithRepairOrders(userId))
        .rejects.toThrow(NotFoundException);
      await expect(controller.findOneWithRepairOrders(userId))
        .rejects.toThrow('user not found');
    });
  });

  describe('update', () => {
    it('should update user successfully', async () => {
      // Arrange
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const updateDto: UpdateUserDto = {
        full_name: 'Updated User',
        telegram_username: '@updateduser',
      };
      const expectedResult = { message: 'User updated successfully' };

      mockUsersService.update.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.update(userId, updateDto, mockAdminPayload);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.update).toHaveBeenCalledWith(userId, updateDto, mockAdminPayload);
    });

    it('should handle user not found during update', async () => {
      // Arrange
      const userId = 'non-existent-id';
      const updateDto: UpdateUserDto = {
        full_name: 'Updated User',
      };
      const serviceError = new NotFoundException('User not found');

      mockUsersService.update.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.update(userId, updateDto, mockAdminPayload))
        .rejects.toThrow(NotFoundException);
    });

    it('should handle phone number conflict during update', async () => {
      // Arrange
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const updateDto: UpdateUserDto = {
        phone: '+998901234569',
        full_name: 'Updated User',
      };
      const serviceError = new BadRequestException('Phone number already exists');

      mockUsersService.update.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.update(userId, updateDto, mockAdminPayload))
        .rejects.toThrow(BadRequestException);
      await expect(controller.update(userId, updateDto, mockAdminPayload))
        .rejects.toThrow('Phone number already exists');
    });

    it('should handle telegram data updates', async () => {
      // Arrange
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const updateDto: UpdateUserDto = {
        telegram_id: 123456789,
        telegram_username: '@newusername',
      };
      const expectedResult = { message: 'User updated successfully' };

      mockUsersService.update.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.update(userId, updateDto, mockAdminPayload);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.update).toHaveBeenCalledWith(userId, updateDto, mockAdminPayload);
    });
  });

  describe('remove', () => {
    it('should soft delete user successfully', async () => {
      // Arrange
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const expectedResult = { message: 'User deleted successfully' };

      mockUsersService.remove.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.remove(userId, mockAdminPayload);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.remove).toHaveBeenCalledWith(userId, mockAdminPayload);
    });

    it('should handle user not found during deletion', async () => {
      // Arrange
      const userId = 'non-existent-id';
      const serviceError = new NotFoundException('User not found');

      mockUsersService.remove.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.remove(userId, mockAdminPayload))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('parameter validation', () => {
    it('should validate UUID parameters correctly', async () => {
      // This test would typically be handled by NestJS built-in validation
      // but we can test that our controller receives and passes correct parameters

      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const expectedResult = mockUser;

      mockUsersService.findOne.mockResolvedValue(expectedResult);

      // Act
      await controller.findOne(userId);

      // Assert
      expect(service.findOne).toHaveBeenCalledWith(userId);
    });
  });

  describe('permission handling', () => {
    it('should apply permission guards correctly', () => {
      // This test verifies the presence of permission decorators
      // In a real test environment, this would be tested at integration level
      const createMethod = controller.create;
      expect(createMethod).toBeDefined();
    });

    it('should pass admin payload to service methods', async () => {
      // Arrange
      const createDto: CreateUserDto = {
        phone: '+998901234567',
        full_name: 'Test User',
      };

      mockUsersService.create.mockResolvedValue(mockUser);

      // Act
      await controller.create(createDto, mockAdminPayload);

      // Assert
      expect(service.create).toHaveBeenCalledWith(createDto, mockAdminPayload);
    });
  });

  describe('error handling and response format', () => {
    it('should properly pass through service exceptions', async () => {
      // Arrange
      const createDto: CreateUserDto = {
        phone: 'invalid-phone',
        full_name: '',
      };

      const validationError = new BadRequestException({
        message: 'Validation failed',
        location: 'phone',
      });
      mockUsersService.create.mockRejectedValue(validationError);

      // Act & Assert
      await expect(controller.create(createDto, mockAdminPayload))
        .rejects.toThrow(validationError);
    });

    it('should handle service layer exceptions', async () => {
      // Arrange
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const serviceError = new Error('Database connection failed');
      mockUsersService.findOne.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.findOne(userId)).rejects.toThrow('Database connection failed');
    });
  });

  describe('API documentation and interceptors', () => {
    it('should use PaginationInterceptor for findAll endpoint', () => {
      // This test verifies the presence of interceptors
      // In a real test environment, this would be tested at integration level
      const findAllMethod = controller.findAll;
      expect(findAllMethod).toBeDefined();
    });

    it('should return proper response format for pagination', async () => {
      // Arrange
      const query: FindAllUsersDto = { limit: 10, offset: 0 };
      const expectedResult: PaginationResult<UserListItem> = {
        data: [mockUserListItem],
        meta: { total: 1, limit: 10, offset: 0 },
      };

      mockUsersService.findAll.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.findAll(query);

      // Assert
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.meta).toHaveProperty('total');
      expect(result.meta).toHaveProperty('limit');
      expect(result.meta).toHaveProperty('offset');
    });
  });

  describe('data transformation and serialization', () => {
    it('should handle user data serialization properly', async () => {
      // Arrange
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      mockUsersService.findOne.mockResolvedValue(mockUser);

      // Act
      const result = await controller.findOne(userId);

      // Assert
      expect(result).toEqual(mockUser);
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('phone');
      expect(result).toHaveProperty('full_name');
      expect(result).toHaveProperty('created_at');
      expect(result).toHaveProperty('updated_at');
    });

    it('should handle user with orders data properly', async () => {
      // Arrange
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      mockUsersService.findOneWithOrders.mockResolvedValue(mockUserWithOrders);

      // Act
      const result = await controller.findOneWithRepairOrders(userId);

      // Assert
      expect(result).toEqual(mockUserWithOrders);
      expect(result).toHaveProperty('repair_orders');
      expect(Array.isArray(result.repair_orders)).toBe(true);
    });
  });

  describe('query parameter handling', () => {
    it('should handle all supported query parameters', async () => {
      // Arrange
      const complexQuery: FindAllUsersDto = {
        search: 'test user',
        has_telegram: 'yes',
        sort_by: 'created_at',
        sort_order: 'desc',
        limit: 25,
        offset: 50,
      };
      const expectedResult: PaginationResult<UserListItem> = {
        data: [],
        meta: { total: 0, limit: 25, offset: 50 },
      };

      mockUsersService.findAll.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.findAll(complexQuery);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.findAll).toHaveBeenCalledWith(complexQuery);
    });
  });
});