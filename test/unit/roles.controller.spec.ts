import { Test, TestingModule } from '@nestjs/testing';
import { RolesController } from '../../src/roles.controller';
import { RolesService } from '../../src/roles.service';
import { NotFoundException } from '@nestjs/common';

describe('RolesController', () => {
  let controller: RolesController;
  let service: RolesService;

  const mockRolesService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
  };

  const mockRole = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test Role',
    description: 'Test Role Description',
    is_active: true,
    status: 'Open',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RolesController],
      providers: [
        {
          provide: RolesService,
          useValue: mockRolesService,
        },
      ],
    }).compile();

    controller = module.get<RolesController>(RolesController);
    service = module.get<RolesService>(RolesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all roles', async () => {
      // Arrange
      const roles = [mockRole];
      mockRolesService.findAll.mockResolvedValue(roles);

      // Act
      const result = await controller.findAll();

      // Assert
      expect(result).toEqual(roles);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return role by id', async () => {
      // Arrange
      const roleId = '550e8400-e29b-41d4-a716-446655440000';
      mockRolesService.findOne.mockResolvedValue(mockRole);

      // Act
      const result = await controller.findOne(roleId);

      // Assert
      expect(result).toEqual(mockRole);
      expect(service.findOne).toHaveBeenCalledWith(roleId);
    });

    it('should handle role not found error', async () => {
      // Arrange
      const roleId = 'non-existent-id';
      const serviceError = new NotFoundException('Role not found');

      mockRolesService.findOne.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.findOne(roleId)).rejects.toThrow(NotFoundException);
    });
  });
});