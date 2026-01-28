import { Test, TestingModule } from '@nestjs/testing';
import { PhoneCategoriesController } from '../../src/phone-categories.controller';
import { PhoneCategoriesService } from '../../src/phone-categories.service';
import { AdminPayload } from '../../src/common/types/admin-payload.interface';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('PhoneCategoriesController', () => {
  let controller: PhoneCategoriesController;
  let service: PhoneCategoriesService;

  const mockPhoneCategoriesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    updateSort: jest.fn(),
  };

  const mockAdminPayload: AdminPayload = {
    id: '660e8400-e29b-41d4-a716-446655440001',
    phone: '+998901234568',
    full_name: 'Test Admin',
    roles: ['admin-role-id'],
  };

  const mockPhoneCategory = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'iPhone',
    parent_id: null,
    is_active: true,
    status: 'Open',
    sort: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PhoneCategoriesController],
      providers: [
        {
          provide: PhoneCategoriesService,
          useValue: mockPhoneCategoriesService,
        },
      ],
    }).compile();

    controller = module.get<PhoneCategoriesController>(PhoneCategoriesController);
    service = module.get<PhoneCategoriesService>(PhoneCategoriesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new phone category successfully', async () => {
      // Arrange
      const createDto = {
        name: 'Samsung',
        parent_id: null,
      };

      mockPhoneCategoriesService.create.mockResolvedValue(mockPhoneCategory);

      // Act
      const result = await controller.create(createDto, mockAdminPayload);

      // Assert
      expect(result).toEqual(mockPhoneCategory);
      expect(service.create).toHaveBeenCalledWith(createDto, mockAdminPayload.id);
    });

    it('should handle duplicate name error', async () => {
      // Arrange
      const createDto = {
        name: 'iPhone',
        parent_id: null,
      };
      const serviceError = new BadRequestException('Category name already exists');

      mockPhoneCategoriesService.create.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.create(createDto, mockAdminPayload))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return all phone categories', async () => {
      // Arrange
      const categories = [mockPhoneCategory];
      mockPhoneCategoriesService.findAll.mockResolvedValue(categories);

      // Act
      const result = await controller.findAll();

      // Assert
      expect(result).toEqual(categories);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return phone category by id', async () => {
      // Arrange
      const categoryId = '550e8400-e29b-41d4-a716-446655440000';
      mockPhoneCategoriesService.findOne.mockResolvedValue(mockPhoneCategory);

      // Act
      const result = await controller.findOne(categoryId);

      // Assert
      expect(result).toEqual(mockPhoneCategory);
      expect(service.findOne).toHaveBeenCalledWith(categoryId);
    });

    it('should handle category not found error', async () => {
      // Arrange
      const categoryId = 'non-existent-id';
      const serviceError = new NotFoundException('Phone category not found');

      mockPhoneCategoriesService.findOne.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.findOne(categoryId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update phone category successfully', async () => {
      // Arrange
      const categoryId = '550e8400-e29b-41d4-a716-446655440000';
      const updateDto = {
        name: 'Updated iPhone',
      };
      const expectedResult = { message: 'Phone category updated successfully' };

      mockPhoneCategoriesService.update.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.update(categoryId, updateDto, mockAdminPayload);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.update).toHaveBeenCalledWith(categoryId, updateDto, mockAdminPayload.id);
    });
  });

  describe('remove', () => {
    it('should delete phone category successfully', async () => {
      // Arrange
      const categoryId = '550e8400-e29b-41d4-a716-446655440000';
      const expectedResult = { message: 'Phone category deleted successfully' };

      mockPhoneCategoriesService.remove.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.remove(categoryId, mockAdminPayload);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.remove).toHaveBeenCalledWith(categoryId, mockAdminPayload.id);
    });
  });

  describe('updateSort', () => {
    it('should update sort order successfully', async () => {
      // Arrange
      const categoryId = '550e8400-e29b-41d4-a716-446655440000';
      const sortDto = { sort: 5 };
      const expectedResult = { message: 'Sort order updated successfully' };

      mockPhoneCategoriesService.updateSort.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.updateSort(categoryId, sortDto, mockAdminPayload);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.updateSort).toHaveBeenCalledWith(categoryId, sortDto.sort, mockAdminPayload.id);
    });
  });
});