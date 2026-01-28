import { Test, TestingModule } from '@nestjs/testing';
import { RepairOrdersController } from '../../src/repair-orders.controller';
import { RepairOrdersService } from '../../src/repair-orders.service';
import { CreateRepairOrderDto } from '../../src/dto/create-repair-order.dto';
import { UpdateRepairOrderDto } from '../../src/dto/update-repair-order.dto';
import { MoveRepairOrderDto } from '../../src/dto/move-repair-order.dto';
import { UpdateRepairOrderSortDto } from '../../src/dto/update-repair-order-sort.dto';
import { FindAllRepairOrdersQueryDto } from '../../src/dto/find-all-repair-orders.dto';
import { AdminPayload } from '../../src/common/types/admin-payload.interface';
import { AuthenticatedRequest } from '../../src/common/types/authenticated-request.type';
import { RepairOrder, FreshRepairOrder, RepairOrderDetails } from '../../src/common/types/repair-order.interface';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('RepairOrdersController', () => {
  let controller: RepairOrdersController;
  let service: RepairOrdersService;

  const mockRepairOrdersService = {
    create: jest.fn(),
    update: jest.fn(),
    findAllByAdminBranch: jest.fn(),
    findById: jest.fn(),
    move: jest.fn(),
    updateSort: jest.fn(),
    softDelete: jest.fn(),
    updateClientInfo: jest.fn(),
    updateProduct: jest.fn(),
    updateProblem: jest.fn(),
  };

  const mockAdminPayload: AdminPayload = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    phone: '+998901234567',
    full_name: 'Test Admin',
    roles: ['admin-role-id'],
  };

  const mockRepairOrder: RepairOrder = {
    id: '660e8400-e29b-41d4-a716-446655440001',
    user_id: '770e8400-e29b-41d4-a716-446655440002',
    branch_id: '880e8400-e29b-41d4-a716-446655440003',
    phone_category_id: '990e8400-e29b-41d4-a716-446655440004',
    status_id: 'aa0e8400-e29b-41d4-a716-446655440005',
    priority: 'Medium',
    sort: 1,
    delivery_method: 'Self',
    pickup_method: 'Self',
    created_by: mockAdminPayload.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as RepairOrder;

  const mockAuthenticatedRequest: AuthenticatedRequest = {
    admin: mockAdminPayload,
    status: {
      id: 'aa0e8400-e29b-41d4-a716-446655440005',
      branch_id: '880e8400-e29b-41d4-a716-446655440003',
    },
    branch: {
      id: '880e8400-e29b-41d4-a716-446655440003',
      name: 'Test Branch',
    },
  } as AuthenticatedRequest;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RepairOrdersController],
      providers: [
        {
          provide: RepairOrdersService,
          useValue: mockRepairOrdersService,
        },
      ],
    }).compile();

    controller = module.get<RepairOrdersController>(RepairOrdersController);
    service = module.get<RepairOrdersService>(RepairOrdersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a repair order successfully', async () => {
      // Arrange
      const createDto: CreateRepairOrderDto = {
        user_id: '770e8400-e29b-41d4-a716-446655440002',
        phone_category_id: '990e8400-e29b-41d4-a716-446655440004',
        status_id: 'aa0e8400-e29b-41d4-a716-446655440005',
        priority: 'High',
      };

      mockRepairOrdersService.create.mockResolvedValue(mockRepairOrder);

      // Act
      const result = await controller.create(mockAuthenticatedRequest, createDto);

      // Assert
      expect(result).toEqual(mockRepairOrder);
      expect(service.create).toHaveBeenCalledWith(
        mockAuthenticatedRequest.admin,
        mockAuthenticatedRequest.status.branch_id,
        mockAuthenticatedRequest.status.id,
        createDto,
      );
    });

    it('should handle service errors properly', async () => {
      // Arrange
      const createDto: CreateRepairOrderDto = {
        user_id: '770e8400-e29b-41d4-a716-446655440002',
        phone_category_id: '990e8400-e29b-41d4-a716-446655440004',
        status_id: 'aa0e8400-e29b-41d4-a716-446655440005',
      };

      const serviceError = new BadRequestException('Invalid user ID');
      mockRepairOrdersService.create.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.create(mockAuthenticatedRequest, createDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('update', () => {
    it('should update a repair order successfully', async () => {
      // Arrange
      const repairOrderId = '660e8400-e29b-41d4-a716-446655440001';
      const updateDto: UpdateRepairOrderDto = {
        priority: 'High',
      };
      const expectedResult = { message: 'Repair order updated successfully' };

      mockRepairOrdersService.update.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.update(repairOrderId, mockAuthenticatedRequest, updateDto);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.update).toHaveBeenCalledWith(
        mockAuthenticatedRequest.admin,
        repairOrderId,
        updateDto,
      );
    });

    it('should handle update errors', async () => {
      // Arrange
      const repairOrderId = 'invalid-id';
      const updateDto: UpdateRepairOrderDto = {};
      const serviceError = new NotFoundException('Repair order not found');

      mockRepairOrdersService.update.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(
        controller.update(repairOrderId, mockAuthenticatedRequest, updateDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAllByBranch', () => {
    it('should return repair orders for a branch', async () => {
      // Arrange
      const query: FindAllRepairOrdersQueryDto = {
        limit: 10,
        offset: 0,
      };
      const expectedResult: Record<string, FreshRepairOrder[]> = {
        'Open': [mockRepairOrder as FreshRepairOrder],
        'In Progress': [],
      };

      mockRepairOrdersService.findAllByAdminBranch.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.findAllByBranch(mockAuthenticatedRequest, query);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.findAllByAdminBranch).toHaveBeenCalledWith(
        mockAuthenticatedRequest.admin,
        mockAuthenticatedRequest.branch.id,
        query,
      );
    });

    it('should handle empty query parameters', async () => {
      // Arrange
      const query: FindAllRepairOrdersQueryDto = {};
      const expectedResult: Record<string, FreshRepairOrder[]> = {};

      mockRepairOrdersService.findAllByAdminBranch.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.findAllByBranch(mockAuthenticatedRequest, query);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.findAllByAdminBranch).toHaveBeenCalledWith(
        mockAuthenticatedRequest.admin,
        mockAuthenticatedRequest.branch.id,
        query,
      );
    });
  });

  describe('findOne', () => {
    it('should return a single repair order by ID', async () => {
      // Arrange
      const repairOrderId = '660e8400-e29b-41d4-a716-446655440001';
      const expectedResult: RepairOrderDetails = {
        ...mockRepairOrder,
        user: { id: '770e8400-e29b-41d4-a716-446655440002', phone: '+998901234568' },
        status: { id: 'aa0e8400-e29b-41d4-a716-446655440005', name: 'Open' },
        comments: [],
        attachments: [],
      } as RepairOrderDetails;

      mockRepairOrdersService.findById.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.findOne(repairOrderId, mockAuthenticatedRequest);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.findById).toHaveBeenCalledWith(mockAuthenticatedRequest.admin, repairOrderId);
    });

    it('should handle not found errors', async () => {
      // Arrange
      const repairOrderId = 'non-existent-id';
      const serviceError = new NotFoundException('Repair order not found');

      mockRepairOrdersService.findById.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(
        controller.findOne(repairOrderId, mockAuthenticatedRequest),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('move', () => {
    it('should move a repair order successfully', async () => {
      // Arrange
      const repairOrderId = '660e8400-e29b-41d4-a716-446655440001';
      const moveDto: MoveRepairOrderDto = {
        target_sort: 2,
      };
      const expectedResult = { message: 'Repair order moved successfully' };

      mockRepairOrdersService.move.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.move(repairOrderId, mockAuthenticatedRequest, moveDto);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.move).toHaveBeenCalledWith(
        mockAuthenticatedRequest.admin,
        repairOrderId,
        moveDto,
      );
    });
  });

  describe('updateSort', () => {
    it('should update sort order successfully', async () => {
      // Arrange
      const repairOrderId = '660e8400-e29b-41d4-a716-446655440001';
      const sortDto: UpdateRepairOrderSortDto = {
        sort: 3,
      };
      const expectedResult = { message: 'Sort order updated successfully' };

      mockRepairOrdersService.updateSort.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.updateSort(repairOrderId, sortDto, mockAdminPayload);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.updateSort).toHaveBeenCalledWith(repairOrderId, sortDto.sort, mockAdminPayload);
    });
  });

  describe('delete', () => {
    it('should soft delete a repair order successfully', async () => {
      // Arrange
      const repairOrderId = '660e8400-e29b-41d4-a716-446655440001';
      const expectedResult = { message: 'Repair order deleted successfully' };

      mockRepairOrdersService.softDelete.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.delete(repairOrderId, mockAuthenticatedRequest);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.softDelete).toHaveBeenCalledWith(
        mockAuthenticatedRequest.admin,
        repairOrderId,
      );
    });

    it('should handle delete errors', async () => {
      // Arrange
      const repairOrderId = 'non-existent-id';
      const serviceError = new NotFoundException('Repair order not found');

      mockRepairOrdersService.softDelete.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(
        controller.delete(repairOrderId, mockAuthenticatedRequest),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateClientInfo', () => {
    it('should update client information successfully', async () => {
      // Arrange
      const repairOrderId = '660e8400-e29b-41d4-a716-446655440001';
      const updateClientDto = {
        user_id: '770e8400-e29b-41d4-a716-446655440002',
      };
      const expectedResult = { message: 'Client information updated successfully' };

      mockRepairOrdersService.updateClientInfo.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.updateClientInfo(
        repairOrderId,
        updateClientDto,
        mockAuthenticatedRequest,
      );

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.updateClientInfo).toHaveBeenCalledWith(
        repairOrderId,
        updateClientDto,
        mockAuthenticatedRequest.admin,
      );
    });
  });

  describe('updateProduct', () => {
    it('should update product information successfully', async () => {
      // Arrange
      const repairOrderId = '660e8400-e29b-41d4-a716-446655440001';
      const updateDto = {
        phone_category_id: '990e8400-e29b-41d4-a716-446655440004',
      };
      const expectedResult = { message: 'Product information updated successfully' };

      mockRepairOrdersService.updateProduct.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.updateProduct(
        repairOrderId,
        updateDto,
        mockAuthenticatedRequest,
      );

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.updateProduct).toHaveBeenCalledWith(
        repairOrderId,
        updateDto,
        mockAuthenticatedRequest.admin,
      );
    });
  });

  describe('error handling and validation', () => {
    it('should properly pass through validation errors', async () => {
      // Arrange
      const createDto: CreateRepairOrderDto = {
        user_id: 'invalid-uuid',
        phone_category_id: '990e8400-e29b-41d4-a716-446655440004',
        status_id: 'aa0e8400-e29b-41d4-a716-446655440005',
      };

      const validationError = new BadRequestException('Invalid UUID format');
      mockRepairOrdersService.create.mockRejectedValue(validationError);

      // Act & Assert
      await expect(controller.create(mockAuthenticatedRequest, createDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle service layer exceptions', async () => {
      // Arrange
      const repairOrderId = '660e8400-e29b-41d4-a716-446655440001';
      const serviceError = new Error('Database connection failed');
      mockRepairOrdersService.findById.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(
        controller.findOne(repairOrderId, mockAuthenticatedRequest),
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('parameter validation', () => {
    it('should validate UUID parameters correctly', async () => {
      // This test would typically be handled by NestJS built-in validation
      // but we can test that our controller receives and passes correct parameters

      const repairOrderId = '660e8400-e29b-41d4-a716-446655440001';
      const expectedResult = { message: 'Operation successful' };

      mockRepairOrdersService.softDelete.mockResolvedValue(expectedResult);

      // Act
      await controller.delete(repairOrderId, mockAuthenticatedRequest);

      // Assert
      expect(service.softDelete).toHaveBeenCalledWith(
        mockAuthenticatedRequest.admin,
        repairOrderId,
      );
    });
  });
});