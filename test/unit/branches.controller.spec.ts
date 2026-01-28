import { Test, TestingModule } from '@nestjs/testing';
import { BranchesController } from '../../src/branches.controller';
import { BranchesService } from '../../src/branches.service';
import { CreateBranchDto } from '../../src/dto/create-branch.dto';
import { UpdateBranchDto } from '../../src/dto/update-branch.dto';
import { AdminPayload } from '../../src/common/types/admin-payload.interface';
import { Branch } from '../../src/common/types/branch.interface';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('BranchesController', () => {
  let controller: BranchesController;
  let service: BranchesService;

  const mockBranchesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    updateSort: jest.fn(),
    assignAdmins: jest.fn(),
    removeAdmins: jest.fn(),
    findByAdminWithPermissions: jest.fn(),
  };

  const mockAdminPayload: AdminPayload = {
    id: '660e8400-e29b-41d4-a716-446655440001',
    phone: '+998901234568',
    full_name: 'Test Admin',
    roles: ['admin-role-id'],
  };

  const mockBranch: Branch = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name_uz: 'Test Branch UZ',
    name_ru: 'Test Branch RU',
    name_en: 'Test Branch EN',
    address: 'Test Address',
    phone: '+998901234567',
    status: 'Open',
    sort: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BranchesController],
      providers: [
        {
          provide: BranchesService,
          useValue: mockBranchesService,
        },
      ],
    }).compile();

    controller = module.get<BranchesController>(BranchesController);
    service = module.get<BranchesService>(BranchesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new branch successfully', async () => {
      // Arrange
      const createDto: CreateBranchDto = {
        name_uz: 'New Branch UZ',
        name_ru: 'New Branch RU',
        name_en: 'New Branch EN',
        address: 'New Address',
        phone: '+998901234567',
      };

      mockBranchesService.create.mockResolvedValue(mockBranch);

      // Act
      const result = await controller.create(createDto, mockAdminPayload);

      // Assert
      expect(result).toEqual(mockBranch);
      expect(service.create).toHaveBeenCalledWith(createDto, mockAdminPayload.id);
    });

    it('should handle duplicate branch name error', async () => {
      // Arrange
      const createDto: CreateBranchDto = {
        name_uz: 'Existing Branch',
        name_ru: 'Existing Branch RU',
        name_en: 'Existing Branch EN',
        address: 'Address',
        phone: '+998901234567',
      };
      const serviceError = new BadRequestException('Branch name already exists');

      mockBranchesService.create.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.create(createDto, mockAdminPayload))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return all branches', async () => {
      // Arrange
      const branches = [mockBranch];
      mockBranchesService.findAll.mockResolvedValue(branches);

      // Act
      const result = await controller.findAll();

      // Assert
      expect(result).toEqual(branches);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return branch by id', async () => {
      // Arrange
      const branchId = '550e8400-e29b-41d4-a716-446655440000';
      mockBranchesService.findOne.mockResolvedValue(mockBranch);

      // Act
      const result = await controller.findOne(branchId);

      // Assert
      expect(result).toEqual(mockBranch);
      expect(service.findOne).toHaveBeenCalledWith(branchId);
    });

    it('should handle branch not found error', async () => {
      // Arrange
      const branchId = 'non-existent-id';
      const serviceError = new NotFoundException('Branch not found');

      mockBranchesService.findOne.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.findOne(branchId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update branch successfully', async () => {
      // Arrange
      const branchId = '550e8400-e29b-41d4-a716-446655440000';
      const updateDto: UpdateBranchDto = {
        name_uz: 'Updated Branch UZ',
      };
      const expectedResult = { message: 'Branch updated successfully' };

      mockBranchesService.update.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.update(branchId, updateDto, mockAdminPayload);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.update).toHaveBeenCalledWith(branchId, updateDto, mockAdminPayload.id);
    });
  });

  describe('remove', () => {
    it('should soft delete branch successfully', async () => {
      // Arrange
      const branchId = '550e8400-e29b-41d4-a716-446655440000';
      const expectedResult = { message: 'Branch deleted successfully' };

      mockBranchesService.remove.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.remove(branchId, mockAdminPayload);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.remove).toHaveBeenCalledWith(branchId, mockAdminPayload.id);
    });
  });
});