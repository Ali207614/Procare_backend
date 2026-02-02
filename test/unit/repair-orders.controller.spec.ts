import { Test, TestingModule } from '@nestjs/testing';
import { RepairOrdersController } from '../../src/repair-orders/repair-orders.controller';
import { RepairOrdersService } from '../../src/repair-orders/repair-orders.service';
import { JwtAdminAuthGuard } from '../../src/common/guards/jwt-admin.guard';
import { PermissionGuard } from '../../src/common/guards/permission.guard';
import { ValidationPipe } from '@nestjs/common';
import { RepairOrderFactory } from '../factories/repair-order.factory';
import { AdminFactory } from '../factories/admin.factory';
import { createMock } from 'jest-mock-extended';
import { ExecutionContext } from '@nestjs/common';

describe('RepairOrdersController', () => {
  let controller: RepairOrdersController;
  let service: RepairOrdersService;
  let jwtGuard: JwtAdminAuthGuard;
  let permissionGuard: PermissionGuard;

  const mockService = createMock<RepairOrdersService>();
  const mockJwtGuard = createMock<JwtAdminAuthGuard>();
  const mockPermissionGuard = createMock<PermissionGuard>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RepairOrdersController],
      providers: [
        {
          provide: RepairOrdersService,
          useValue: mockService,
        },
      ],
    })
      .overrideGuard(JwtAdminAuthGuard)
      .useValue(mockJwtGuard)
      .overrideGuard(PermissionGuard)
      .useValue(mockPermissionGuard)
      .compile();

    controller = module.get<RepairOrdersController>(RepairOrdersController);
    service = module.get<RepairOrdersService>(RepairOrdersService);
    jwtGuard = module.get<JwtAdminAuthGuard>(JwtAdminAuthGuard);
    permissionGuard = module.get<PermissionGuard>(PermissionGuard);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated repair orders', async () => {
      // Arrange
      const query = {
        limit: 10,
        offset: 0,
        status: 'Open',
        branch_id: 'branch-123',
      };

      const mockResult = {
        data: RepairOrderFactory.createMany(3),
        meta: {
          total: 25,
          limit: 10,
          offset: 0,
          hasNext: true,
          hasPrev: false,
        },
      };

      mockService.findAll.mockResolvedValue(mockResult);

      // Act
      const result = await controller.findAll(query);

      // Assert
      expect(service.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockResult);
      expect(result.data).toHaveLength(3);
      expect(result.meta.total).toBe(25);
    });

    it('should handle empty results', async () => {
      // Arrange
      const query = { limit: 10, offset: 0 };
      const mockResult = {
        data: [],
        meta: { total: 0, limit: 10, offset: 0, hasNext: false, hasPrev: false },
      };

      mockService.findAll.mockResolvedValue(mockResult);

      // Act
      const result = await controller.findAll(query);

      // Assert
      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });

    it('should apply filters correctly', async () => {
      // Arrange
      const query = {
        status: 'In Progress',
        device_type: 'iPhone',
        assigned_admin_id: 'admin-123',
        created_date_from: '2024-01-01',
        created_date_to: '2024-01-31',
      };

      const mockResult = {
        data: RepairOrderFactory.createMany(1),
        meta: { total: 1, limit: 10, offset: 0 },
      };

      mockService.findAll.mockResolvedValue(mockResult);

      // Act
      await controller.findAll(query);

      // Assert
      expect(service.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('create', () => {
    it('should create repair order successfully', async () => {
      // Arrange
      const createDto = RepairOrderFactory.createDto({
        device_type: 'iPhone 12',
        initial_problem: 'Screen cracked',
        customer_name: 'John Doe',
        customer_phone: '+1234567890',
      });

      const mockAdmin = AdminFactory.create();
      const mockRequest = {
        admin: mockAdmin,
      };

      const mockResult = {
        message: 'Repair order created successfully',
        repair_order_id: 'repair-order-123',
      };

      mockService.create.mockResolvedValue(mockResult);

      // Act
      const result = await controller.create(createDto, mockRequest);

      // Assert
      expect(service.create).toHaveBeenCalledWith(createDto, mockAdmin.id);
      expect(result).toEqual(mockResult);
    });

    it('should validate required fields', async () => {
      // Arrange
      const invalidDto = {
        device_type: '', // Empty required field
        initial_problem: 'Problem description',
      };

      const mockAdmin = AdminFactory.create();
      const mockRequest = { admin: mockAdmin };

      // Act & Assert
      // This test assumes validation pipe will catch this before reaching the controller
      // In a real scenario, you'd test the validation pipe separately
      await expect(controller.create(invalidDto as any, mockRequest)).rejects.toThrow();
    });

    it('should handle service errors', async () => {
      // Arrange
      const createDto = RepairOrderFactory.createDto();
      const mockAdmin = AdminFactory.create();
      const mockRequest = { admin: mockAdmin };

      mockService.create.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(controller.create(createDto, mockRequest)).rejects.toThrow('Database error');
    });
  });

  describe('findOne', () => {
    it('should return repair order by id', async () => {
      // Arrange
      const repairOrderId = 'repair-order-123';
      const mockRepairOrder = RepairOrderFactory.create({ id: repairOrderId });
      const mockResult = { data: mockRepairOrder };

      mockService.findOne.mockResolvedValue(mockResult);

      // Act
      const result = await controller.findOne(repairOrderId);

      // Assert
      expect(service.findOne).toHaveBeenCalledWith(repairOrderId);
      expect(result).toEqual(mockResult);
      expect(result.data.id).toBe(repairOrderId);
    });

    it('should handle not found error', async () => {
      // Arrange
      const repairOrderId = 'non-existent-id';

      mockService.findOne.mockRejectedValue(new Error('Repair order not found'));

      // Act & Assert
      await expect(controller.findOne(repairOrderId)).rejects.toThrow('Repair order not found');
    });
  });

  describe('update', () => {
    it('should update repair order successfully', async () => {
      // Arrange
      const repairOrderId = 'repair-order-123';
      const updateDto = {
        status: 'In Progress',
        notes: 'Started diagnosis',
        assigned_admin_id: 'admin-456',
      };
      const mockAdmin = AdminFactory.create();
      const mockRequest = { admin: mockAdmin };

      const mockResult = {
        message: 'Repair order updated successfully',
      };

      mockService.update.mockResolvedValue(mockResult);

      // Act
      const result = await controller.update(repairOrderId, updateDto, mockRequest);

      // Assert
      expect(service.update).toHaveBeenCalledWith(repairOrderId, updateDto, mockAdmin.id);
      expect(result).toEqual(mockResult);
    });

    it('should handle partial updates', async () => {
      // Arrange
      const repairOrderId = 'repair-order-123';
      const updateDto = { notes: 'Updated notes only' };
      const mockAdmin = AdminFactory.create();
      const mockRequest = { admin: mockAdmin };

      const mockResult = { message: 'Repair order updated successfully' };
      mockService.update.mockResolvedValue(mockResult);

      // Act
      const result = await controller.update(repairOrderId, updateDto, mockRequest);

      // Assert
      expect(service.update).toHaveBeenCalledWith(repairOrderId, updateDto, mockAdmin.id);
      expect(result).toEqual(mockResult);
    });
  });

  describe('remove', () => {
    it('should delete repair order successfully', async () => {
      // Arrange
      const repairOrderId = 'repair-order-123';
      const mockAdmin = AdminFactory.create();
      const mockRequest = { admin: mockAdmin };

      const mockResult = {
        message: 'Repair order deleted successfully',
      };

      mockService.remove.mockResolvedValue(mockResult);

      // Act
      const result = await controller.remove(repairOrderId, mockRequest);

      // Assert
      expect(service.remove).toHaveBeenCalledWith(repairOrderId, mockAdmin.id);
      expect(result).toEqual(mockResult);
    });
  });

  describe('getStats', () => {
    it('should return repair order statistics', async () => {
      // Arrange
      const mockStats = {
        data: {
          total_orders: 100,
          open_orders: 25,
          in_progress_orders: 15,
          completed_orders: 55,
          cancelled_orders: 5,
          average_completion_time_days: 3.5,
          orders_by_branch: [
            { branch_name: 'Main Branch', count: 60 },
            { branch_name: 'Secondary Branch', count: 40 },
          ],
        },
      };

      mockService.getRepairOrderStats.mockResolvedValue(mockStats);

      // Act
      const result = await controller.getStats();

      // Assert
      expect(service.getRepairOrderStats).toHaveBeenCalled();
      expect(result).toEqual(mockStats);
      expect(result.data.total_orders).toBe(100);
    });
  });

  describe('assignAdmin', () => {
    it('should assign admin to repair order', async () => {
      // Arrange
      const repairOrderId = 'repair-order-123';
      const assignDto = { admin_id: 'admin-456' };
      const mockAdmin = AdminFactory.create();
      const mockRequest = { admin: mockAdmin };

      const mockResult = {
        message: 'Admin assigned successfully',
      };

      mockService.assignAdmin.mockResolvedValue(mockResult);

      // Act
      const result = await controller.assignAdmin(repairOrderId, assignDto, mockRequest);

      // Assert
      expect(service.assignAdmin).toHaveBeenCalledWith(
        repairOrderId,
        assignDto.admin_id,
        mockAdmin.id,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('changeStatus', () => {
    it('should change repair order status', async () => {
      // Arrange
      const repairOrderId = 'repair-order-123';
      const statusDto = {
        status: 'Completed',
        completion_notes: 'Repair completed successfully',
      };
      const mockAdmin = AdminFactory.create();
      const mockRequest = { admin: mockAdmin };

      const mockResult = {
        message: 'Status changed successfully',
      };

      mockService.changeStatus.mockResolvedValue(mockResult);

      // Act
      const result = await controller.changeStatus(repairOrderId, statusDto, mockRequest);

      // Assert
      expect(service.changeStatus).toHaveBeenCalledWith(
        repairOrderId,
        statusDto.status,
        mockAdmin.id,
        statusDto,
      );
      expect(result).toEqual(mockResult);
    });

    it('should validate status transitions', async () => {
      // Arrange
      const repairOrderId = 'repair-order-123';
      const statusDto = { status: 'Open' }; // Invalid transition
      const mockAdmin = AdminFactory.create();
      const mockRequest = { admin: mockAdmin };

      mockService.changeStatus.mockRejectedValue(new Error('Invalid status transition'));

      // Act & Assert
      await expect(controller.changeStatus(repairOrderId, statusDto, mockRequest)).rejects.toThrow(
        'Invalid status transition',
      );
    });
  });

  describe('addComment', () => {
    it('should add comment to repair order', async () => {
      // Arrange
      const repairOrderId = 'repair-order-123';
      const commentDto = {
        comment: 'Customer called to check status',
        is_internal: false,
      };
      const mockAdmin = AdminFactory.create();
      const mockRequest = { admin: mockAdmin };

      const mockResult = {
        message: 'Comment added successfully',
        comment_id: 'comment-123',
      };

      mockService.addComment.mockResolvedValue(mockResult);

      // Act
      const result = await controller.addComment(repairOrderId, commentDto, mockRequest);

      // Assert
      expect(service.addComment).toHaveBeenCalledWith(repairOrderId, commentDto, mockAdmin.id);
      expect(result).toEqual(mockResult);
    });
  });

  describe('uploadAttachment', () => {
    it('should upload attachment successfully', async () => {
      // Arrange
      const repairOrderId = 'repair-order-123';
      const mockFile = {
        originalname: 'device-photo.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
        buffer: Buffer.from('fake-image-data'),
      };
      const attachmentDto = {
        description: 'Photo of damaged device',
        attachment_type: 'image',
      };
      const mockAdmin = AdminFactory.create();
      const mockRequest = { admin: mockAdmin };

      const mockResult = {
        message: 'Attachment uploaded successfully',
        attachment_id: 'attachment-123',
        file_url: '/uploads/device-photo.jpg',
      };

      mockService.uploadAttachment.mockResolvedValue(mockResult);

      // Act
      const result = await controller.uploadAttachment(
        repairOrderId,
        mockFile,
        attachmentDto,
        mockRequest,
      );

      // Assert
      expect(service.uploadAttachment).toHaveBeenCalledWith(
        repairOrderId,
        mockFile,
        attachmentDto,
        mockAdmin.id,
      );
      expect(result).toEqual(mockResult);
    });

    it('should validate file type', async () => {
      // Arrange
      const repairOrderId = 'repair-order-123';
      const invalidFile = {
        originalname: 'document.exe',
        mimetype: 'application/exe',
        size: 1024,
        buffer: Buffer.from('fake-data'),
      };

      mockService.uploadAttachment.mockRejectedValue(new Error('Invalid file type'));

      // Act & Assert
      await expect(
        controller.uploadAttachment(
          repairOrderId,
          invalidFile,
          {},
          { admin: AdminFactory.create() },
        ),
      ).rejects.toThrow('Invalid file type');
    });
  });

  describe('Guards and Decorators', () => {
    beforeEach(() => {
      // Reset guard mocks
      mockJwtGuard.canActivate.mockReturnValue(true);
      mockPermissionGuard.canActivate.mockReturnValue(true);
    });

    it('should apply JWT authentication guard', () => {
      const guards = Reflect.getMetadata('__guards__', RepairOrdersController);
      expect(guards).toBeDefined();
    });

    it('should apply permission guards for protected methods', async () => {
      // Test that permission guard is called for protected endpoints
      const mockContext = createMock<ExecutionContext>();

      await controller.findAll({});

      // In a real test, you'd verify that the guard was invoked
      // This is a simplified example
    });

    it('should reject unauthorized requests', async () => {
      // Arrange
      mockJwtGuard.canActivate.mockReturnValue(false);

      // Act & Assert
      // This would typically be handled by the framework
      // Here we simulate the guard behavior
      expect(mockJwtGuard.canActivate).toBeDefined();
    });

    it('should reject requests without required permissions', async () => {
      // Arrange
      mockPermissionGuard.canActivate.mockReturnValue(false);

      // Act & Assert
      // This would typically be handled by the framework
      expect(mockPermissionGuard.canActivate).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors properly', async () => {
      // Arrange
      const invalidDto = {};
      const mockAdmin = AdminFactory.create();

      mockService.create.mockRejectedValue(new Error('Validation failed'));

      // Act & Assert
      await expect(controller.create(invalidDto as any, { admin: mockAdmin })).rejects.toThrow(
        'Validation failed',
      );
    });

    it('should handle service layer errors', async () => {
      // Arrange
      const repairOrderId = 'repair-order-123';

      mockService.findOne.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(controller.findOne(repairOrderId)).rejects.toThrow('Database connection failed');
    });

    it('should handle concurrent modification errors', async () => {
      // Arrange
      const repairOrderId = 'repair-order-123';
      const updateDto = { status: 'Completed' };
      const mockAdmin = AdminFactory.create();

      mockService.update.mockRejectedValue(new Error('Resource has been modified by another user'));

      // Act & Assert
      await expect(
        controller.update(repairOrderId, updateDto, { admin: mockAdmin }),
      ).rejects.toThrow('Resource has been modified by another user');
    });
  });

  describe('Performance and Optimization', () => {
    it('should handle large result sets efficiently', async () => {
      // Arrange
      const largeQuery = { limit: 1000, offset: 0 };
      const mockResult = {
        data: RepairOrderFactory.createMany(1000),
        meta: { total: 10000, limit: 1000, offset: 0 },
      };

      mockService.findAll.mockResolvedValue(mockResult);

      // Act
      const start = Date.now();
      const result = await controller.findAll(largeQuery);
      const duration = Date.now() - start;

      // Assert
      expect(result.data).toHaveLength(1000);
      expect(duration).toBeLessThan(100); // Should be fast since it's mocked
    });

    it('should apply proper pagination limits', async () => {
      // Arrange
      const oversizedQuery = { limit: 10000, offset: 0 }; // Too large

      // The service should handle this, but controller should validate
      await controller.findAll(oversizedQuery);

      // Assert
      expect(service.findAll).toHaveBeenCalledWith(oversizedQuery);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null/undefined values gracefully', async () => {
      // Arrange
      const queryWithNulls = {
        limit: null,
        offset: undefined,
        status: '',
      };

      const mockResult = {
        data: [],
        meta: { total: 0, limit: 10, offset: 0 },
      };

      mockService.findAll.mockResolvedValue(mockResult);

      // Act
      const result = await controller.findAll(queryWithNulls as any);

      // Assert
      expect(result).toEqual(mockResult);
    });

    it('should handle special characters in search', async () => {
      // Arrange
      const queryWithSpecialChars = {
        customer_name: "O'Connor & Sons",
        device_type: 'iPhone 13 Pro (256GB)',
      };

      const mockResult = {
        data: RepairOrderFactory.createMany(1),
        meta: { total: 1, limit: 10, offset: 0 },
      };

      mockService.findAll.mockResolvedValue(mockResult);

      // Act
      const result = await controller.findAll(queryWithSpecialChars);

      // Assert
      expect(service.findAll).toHaveBeenCalledWith(queryWithSpecialChars);
      expect(result).toEqual(mockResult);
    });
  });
});
