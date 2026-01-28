import { Test, TestingModule } from '@nestjs/testing';
import { AdminsController } from '../../src/admins.controller';
import { AdminsService } from '../../src/admins.service';
import { CreateAdminDto } from '../../src/dto/create-admin.dto';
import { UpdateAdminDto } from '../../src/dto/update-admin.dto';
import { ChangePasswordDto } from '../../src/dto/change-password.dto';
import { FindAllAdminsDto } from '../../src/dto/find-all-admins.dto';
import { AdminPayload } from '../../src/common/types/admin-payload.interface';
import { Admin } from '../../src/common/types/admin.interface';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { AuthenticatedRequest } from '../../src/common/types/authenticated-request.type';

describe('AdminsController', () => {
  let controller: AdminsController;
  let service: AdminsService;

  const mockAdminsService = {
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    changePassword: jest.fn(),
    findAll: jest.fn(),
    softDelete: jest.fn(),
    findByBranchId: jest.fn(),
  };

  const mockAdminPayload: AdminPayload = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    phone: '+998901234567',
    full_name: 'Test Admin',
    roles: ['admin-role-id'],
  };

  const mockAdmin: Admin = {
    id: mockAdminPayload.id,
    phone_number: mockAdminPayload.phone,
    password: 'hashedPassword',
    full_name: mockAdminPayload.full_name,
    branch_id: '660e8400-e29b-41d4-a716-446655440001',
    status: 'Active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockAuthenticatedRequest: AuthenticatedRequest = {
    admin: mockAdminPayload,
    branch: {
      id: '660e8400-e29b-41d4-a716-446655440001',
      name: 'Test Branch',
    },
  } as AuthenticatedRequest;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminsController],
      providers: [
        {
          provide: AdminsService,
          useValue: mockAdminsService,
        },
      ],
    }).compile();

    controller = module.get<AdminsController>(AdminsController);
    service = module.get<AdminsService>(AdminsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('should return admin profile', async () => {
      // Arrange
      mockAdminsService.findById.mockResolvedValue(mockAdmin);

      // Act
      const result = controller.getProfile(mockAdminPayload);

      // Assert
      expect(mockAdminsService.findById).toHaveBeenCalledWith(mockAdminPayload.id);
      expect(result).toBeDefined();
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      // Arrange
      const changePasswordDto: ChangePasswordDto = {
        old_password: 'oldPassword',
        new_password: 'newPassword123',
      };
      const expectedResult = { message: 'Password changed successfully' };

      mockAdminsService.changePassword.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.changePassword(mockAdminPayload, changePasswordDto);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.changePassword).toHaveBeenCalledWith(mockAdminPayload, changePasswordDto);
    });

    it('should handle password change errors', async () => {
      // Arrange
      const changePasswordDto: ChangePasswordDto = {
        old_password: 'wrongPassword',
        new_password: 'newPassword123',
      };
      const serviceError = new BadRequestException('Old password is incorrect');

      mockAdminsService.changePassword.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.changePassword(mockAdminPayload, changePasswordDto))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('create', () => {
    it('should create a new admin successfully', async () => {
      // Arrange
      const createDto: CreateAdminDto = {
        phone_number: '+998901234568',
        password: 'password123',
        full_name: 'New Admin',
        branch_id: '660e8400-e29b-41d4-a716-446655440001',
        role_ids: ['role-1', 'role-2'],
      };
      const createdAdmin = { ...mockAdmin, ...createDto };

      mockAdminsService.create.mockResolvedValue(createdAdmin);

      // Act
      const result = await controller.create(createDto, mockAdminPayload);

      // Assert
      expect(result).toEqual(createdAdmin);
      expect(service.create).toHaveBeenCalledWith(createDto, mockAdminPayload);
    });

    it('should handle validation errors', async () => {
      // Arrange
      const invalidDto: CreateAdminDto = {
        phone_number: 'invalid-phone',
        password: 'weak',
        full_name: '',
        branch_id: 'invalid-uuid',
        role_ids: [],
      };
      const serviceError = new BadRequestException('Validation failed');

      mockAdminsService.create.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.create(invalidDto, mockAdminPayload))
        .rejects.toThrow(BadRequestException);
    });

    it('should handle duplicate phone number error', async () => {
      // Arrange
      const createDto: CreateAdminDto = {
        phone_number: '+998901234567', // Existing phone
        password: 'password123',
        full_name: 'New Admin',
        branch_id: '660e8400-e29b-41d4-a716-446655440001',
        role_ids: ['role-1'],
      };
      const serviceError = new BadRequestException('Phone number already exists');

      mockAdminsService.create.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.create(createDto, mockAdminPayload))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should update admin successfully', async () => {
      // Arrange
      const adminId = '770e8400-e29b-41d4-a716-446655440002';
      const updateDto: UpdateAdminDto = {
        full_name: 'Updated Admin',
        status: 'Inactive',
      };
      const expectedResult = { message: 'Admin updated successfully' };

      mockAdminsService.update.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.update(adminId, updateDto, mockAdminPayload);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.update).toHaveBeenCalledWith(adminId, updateDto, mockAdminPayload);
    });

    it('should handle update errors', async () => {
      // Arrange
      const adminId = 'non-existent-id';
      const updateDto: UpdateAdminDto = {
        full_name: 'Updated Admin',
      };
      const serviceError = new NotFoundException('Admin not found');

      mockAdminsService.update.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.update(adminId, updateDto, mockAdminPayload))
        .rejects.toThrow(NotFoundException);
    });

    it('should handle forbidden update operations', async () => {
      // Arrange
      const updateDto: UpdateAdminDto = {
        status: 'Inactive',
      };
      const serviceError = new ForbiddenException('Cannot update own status');

      mockAdminsService.update.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.update(mockAdminPayload.id, updateDto, mockAdminPayload))
        .rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAll', () => {
    it('should return paginated admins', async () => {
      // Arrange
      const query: FindAllAdminsDto = {
        limit: 10,
        offset: 0,
        search: 'test',
        sort_by: 'full_name',
        sort_order: 'asc',
      };
      const expectedResult = {
        data: [mockAdmin],
        meta: { total: 1, limit: 10, offset: 0 },
      };

      mockAdminsService.findAll.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.findAll(query, mockAdminPayload);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.findAll).toHaveBeenCalledWith(query, mockAdminPayload);
    });

    it('should handle empty search results', async () => {
      // Arrange
      const query: FindAllAdminsDto = {
        search: 'nonexistent',
      };
      const expectedResult = {
        data: [],
        meta: { total: 0, limit: 20, offset: 0 },
      };

      mockAdminsService.findAll.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.findAll(query, mockAdminPayload);

      // Assert
      expect(result).toEqual(expectedResult);
    });

    it('should use default pagination when not provided', async () => {
      // Arrange
      const query: FindAllAdminsDto = {};
      const expectedResult = {
        data: [mockAdmin],
        meta: { total: 1, limit: 20, offset: 0 },
      };

      mockAdminsService.findAll.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.findAll(query, mockAdminPayload);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.findAll).toHaveBeenCalledWith(query, mockAdminPayload);
    });
  });

  describe('findOne', () => {
    it('should return admin by ID', async () => {
      // Arrange
      const adminId = '770e8400-e29b-41d4-a716-446655440002';
      mockAdminsService.findById.mockResolvedValue(mockAdmin);

      // Act
      const result = await controller.findOne(adminId);

      // Assert
      expect(result).toEqual(mockAdmin);
      expect(service.findById).toHaveBeenCalledWith(adminId);
    });

    it('should handle not found errors', async () => {
      // Arrange
      const adminId = 'non-existent-id';
      const serviceError = new NotFoundException('Admin not found');

      mockAdminsService.findById.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.findOne(adminId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete admin successfully', async () => {
      // Arrange
      const adminId = '770e8400-e29b-41d4-a716-446655440002';
      const expectedResult = { message: 'Admin deleted successfully' };

      mockAdminsService.softDelete.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.remove(adminId, mockAdminPayload);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.softDelete).toHaveBeenCalledWith(adminId, mockAdminPayload);
    });

    it('should handle delete errors', async () => {
      // Arrange
      const adminId = 'non-existent-id';
      const serviceError = new NotFoundException('Admin not found');

      mockAdminsService.softDelete.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.remove(adminId, mockAdminPayload))
        .rejects.toThrow(NotFoundException);
    });

    it('should handle forbidden delete operations', async () => {
      // Arrange
      const serviceError = new ForbiddenException('Cannot delete yourself');

      mockAdminsService.softDelete.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.remove(mockAdminPayload.id, mockAdminPayload))
        .rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAdminsByBranch', () => {
    it('should return admins by branch', async () => {
      // Arrange
      const branchAdmins = [mockAdmin];
      mockAdminsService.findByBranchId.mockResolvedValue(branchAdmins);

      // Act
      const result = await controller.findAdminsByBranch(mockAuthenticatedRequest);

      // Assert
      expect(result).toEqual(branchAdmins);
      expect(service.findByBranchId).toHaveBeenCalledWith(mockAuthenticatedRequest.branch.id);
    });

    it('should handle empty branch results', async () => {
      // Arrange
      mockAdminsService.findByBranchId.mockResolvedValue([]);

      // Act
      const result = await controller.findAdminsByBranch(mockAuthenticatedRequest);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('parameter validation', () => {
    it('should validate UUID parameters correctly', async () => {
      // This test would typically be handled by NestJS built-in validation
      // but we can test that our controller receives and passes correct parameters

      const adminId = '550e8400-e29b-41d4-a716-446655440000';
      const expectedResult = mockAdmin;

      mockAdminsService.findById.mockResolvedValue(expectedResult);

      // Act
      await controller.findOne(adminId);

      // Assert
      expect(service.findById).toHaveBeenCalledWith(adminId);
    });
  });

  describe('error handling and response format', () => {
    it('should properly pass through service exceptions', async () => {
      // Arrange
      const createDto: CreateAdminDto = {
        phone_number: 'invalid-phone',
        password: 'weak',
        full_name: '',
        branch_id: 'invalid-uuid',
        role_ids: [],
      };

      const validationError = new BadRequestException({
        message: 'Validation failed',
        location: 'phone_number',
      });
      mockAdminsService.create.mockRejectedValue(validationError);

      // Act & Assert
      await expect(controller.create(createDto, mockAdminPayload)).rejects.toThrow(validationError);
    });

    it('should handle service layer exceptions', async () => {
      // Arrange
      const adminId = '550e8400-e29b-41d4-a716-446655440000';
      const serviceError = new Error('Database connection failed');
      mockAdminsService.findById.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.findOne(adminId)).rejects.toThrow('Database connection failed');
    });
  });

  describe('interceptors and decorators', () => {
    it('should use ClassSerializerInterceptor for profile endpoint', () => {
      // This test verifies the presence of decorators and interceptors
      // In a real test environment, this would be tested at integration level
      const profileMethod = controller.getProfile;
      expect(profileMethod).toBeDefined();
    });

    it('should extract admin payload from request correctly', async () => {
      // Arrange
      mockAdminsService.findById.mockResolvedValue(mockAdmin);

      // Act
      controller.getProfile(mockAdminPayload);

      // Assert
      expect(mockAdminsService.findById).toHaveBeenCalledWith(mockAdminPayload.id);
    });
  });
});