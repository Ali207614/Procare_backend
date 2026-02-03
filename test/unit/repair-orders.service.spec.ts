import { Test, TestingModule } from '@nestjs/testing';
import { RepairOrdersService } from '../../src/repair-orders/repair-orders.service';
import { RepairOrderFactory } from '../factories/repair-order.factory';
import { AdminFactory } from '../factories/admin.factory';
import { UserFactory } from '../factories/user.factory';
import { BranchFactory } from '../factories/branch.factory';

describe('RepairOrdersService', () => {
  let service: RepairOrdersService;
  let mockKnex: any;
  let mockRedis: any;
  let mockTelegramService: any;
  let mockNotificationService: any;

  beforeEach(async () => {
    mockKnex = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      first: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      del: jest.fn(),
      count: jest.fn(),
      leftJoin: jest.fn().mockReturnThis(),
      join: jest.fn().mockReturnThis(),
      transaction: jest.fn(),
      raw: jest.fn(),
    };

    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      flushall: jest.fn(),
    };

    mockTelegramService = {
      sendMessage: jest.fn(),
    };

    mockNotificationService = {
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepairOrdersService,
        { provide: 'KnexConnection', useValue: mockKnex },
        { provide: 'RedisClient', useValue: mockRedis },
        { provide: 'TelegramService', useValue: mockTelegramService },
        { provide: 'NotificationService', useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get<RepairOrdersService>(RepairOrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return repair orders with pagination', async () => {
      // Arrange
      const mockRepairOrders = RepairOrderFactory.createMany(3);
      const mockCount = [{ count: '5' }];

      mockKnex.count.mockResolvedValueOnce(mockCount);
      mockKnex.first.mockResolvedValueOnce(mockRepairOrders);

      // Act
      const result = await service.findAll({ limit: 3, offset: 0 });

      // Assert
      expect(result.data).toEqual(mockRepairOrders);
      expect(result.meta.total).toBe(5);
      expect(result.meta.limit).toBe(3);
      expect(result.meta.offset).toBe(0);
    });

    it('should filter by status', async () => {
      // Arrange
      const mockRepairOrders = [RepairOrderFactory.create({ status: 'Open' })];
      const mockCount = [{ count: '1' }];

      mockKnex.count.mockResolvedValueOnce(mockCount);
      mockKnex.first.mockResolvedValueOnce(mockRepairOrders);

      // Act
      const result = await service.findAll({ status: 'Open' });

      // Assert
      expect(mockKnex.where).toHaveBeenCalledWith('repair_orders.status', 'Open');
      expect(result.data).toEqual(mockRepairOrders);
    });

    it('should filter by branch', async () => {
      // Arrange
      const branchId = 'branch-123';
      const mockRepairOrders = [RepairOrderFactory.create({ branch_id: branchId })];
      const mockCount = [{ count: '1' }];

      mockKnex.count.mockResolvedValueOnce(mockCount);
      mockKnex.first.mockResolvedValueOnce(mockRepairOrders);

      // Act
      const result = await service.findAll({ branch_id: branchId });

      // Assert
      expect(mockKnex.where).toHaveBeenCalledWith('repair_orders.branch_id', branchId);
    });
  });

  describe('create', () => {
    it('should create repair order successfully', async () => {
      // Arrange
      const repairOrderDto = RepairOrderFactory.createDto();
      const adminId = 'admin-123';
      const mockInsertId = ['repair-order-123'];

      mockKnex.insert.mockResolvedValueOnce(mockInsertId);
      mockKnex.transaction.mockImplementation((callback) => callback(mockKnex));

      // Act
      const result = await service.create(repairOrderDto, adminId);

      // Assert
      expect(result.message).toBe('Repair order created successfully');
      expect(result.repair_order_id).toBe(mockInsertId[0]);
      expect(mockKnex.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          created_by: adminId,
          status: 'Open',
        }),
      );
    });

    it('should handle validation errors', async () => {
      // Arrange
      const invalidDto = { device_type: '' }; // Invalid data

      // Act & Assert
      await expect(service.create(invalidDto as any, 'admin-123')).rejects.toThrow(
        'Validation failed',
      );
    });
  });

  describe('findOne', () => {
    it('should return repair order by id', async () => {
      // Arrange
      const repairOrderId = 'repair-order-123';
      const mockRepairOrder = RepairOrderFactory.create({ id: repairOrderId });

      mockKnex.first.mockResolvedValueOnce(mockRepairOrder);

      // Act
      const result = await service.findOne(repairOrderId);

      // Assert
      expect(result.data).toEqual(mockRepairOrder);
      expect(mockKnex.where).toHaveBeenCalledWith('repair_orders.id', repairOrderId);
      expect(mockKnex.whereNull).toHaveBeenCalledWith('repair_orders.deleted_at');
    });

    it('should throw error for non-existent repair order', async () => {
      // Arrange
      mockKnex.first.mockResolvedValueOnce(null);

      // Act & Assert
      await expect(service.findOne('non-existent-id')).rejects.toThrow('Repair order not found');
    });

    it('should cache repair order data', async () => {
      // Arrange
      const repairOrderId = 'repair-order-123';
      const mockRepairOrder = RepairOrderFactory.create({ id: repairOrderId });

      mockRedis.get.mockResolvedValueOnce(null);
      mockKnex.first.mockResolvedValueOnce(mockRepairOrder);

      // Act
      await service.findOne(repairOrderId);

      // Assert
      expect(mockRedis.set).toHaveBeenCalledWith(
        `repair_order:${repairOrderId}`,
        JSON.stringify(mockRepairOrder),
        'EX',
        3600,
      );
    });
  });

  describe('update', () => {
    it('should update repair order successfully', async () => {
      // Arrange
      const repairOrderId = 'repair-order-123';
      const updateDto = { status: 'In Progress', notes: 'Updated notes' };
      const adminId = 'admin-123';
      const mockRepairOrder = RepairOrderFactory.create({ id: repairOrderId });

      mockKnex.first.mockResolvedValueOnce(mockRepairOrder);
      mockKnex.update.mockResolvedValueOnce(1);
      mockKnex.transaction.mockImplementation((callback) => callback(mockKnex));

      // Act
      const result = await service.update(repairOrderId, updateDto, adminId);

      // Assert
      expect(result.message).toBe('Repair order updated successfully');
      expect(mockKnex.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'In Progress',
          notes: 'Updated notes',
          updated_by: adminId,
        }),
      );
    });

    it('should invalidate cache after update', async () => {
      // Arrange
      const repairOrderId = 'repair-order-123';
      const updateDto = { status: 'In Progress' };
      const adminId = 'admin-123';
      const mockRepairOrder = RepairOrderFactory.create({ id: repairOrderId });

      mockKnex.first.mockResolvedValueOnce(mockRepairOrder);
      mockKnex.update.mockResolvedValueOnce(1);
      mockKnex.transaction.mockImplementation((callback) => callback(mockKnex));

      // Act
      await service.update(repairOrderId, updateDto, adminId);

      // Assert
      expect(mockRedis.del).toHaveBeenCalledWith(`repair_order:${repairOrderId}`);
    });

    it('should log status change', async () => {
      // Arrange
      const repairOrderId = 'repair-order-123';
      const updateDto = { status: 'Completed' };
      const adminId = 'admin-123';
      const mockRepairOrder = RepairOrderFactory.create({
        id: repairOrderId,
        status: 'In Progress',
      });

      mockKnex.first.mockResolvedValueOnce(mockRepairOrder);
      mockKnex.update.mockResolvedValueOnce(1);
      mockKnex.transaction.mockImplementation((callback) => callback(mockKnex));

      // Act
      await service.update(repairOrderId, updateDto, adminId);

      // Assert
      expect(mockKnex.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          repair_order_id: repairOrderId,
          change_type: 'status_change',
          old_value: 'In Progress',
          new_value: 'Completed',
          changed_by: adminId,
        }),
      );
    });
  });

  describe('remove', () => {
    it('should soft delete repair order', async () => {
      // Arrange
      const repairOrderId = 'repair-order-123';
      const adminId = 'admin-123';
      const mockRepairOrder = RepairOrderFactory.create({ id: repairOrderId });

      mockKnex.first.mockResolvedValueOnce(mockRepairOrder);
      mockKnex.update.mockResolvedValueOnce(1);

      // Act
      const result = await service.remove(repairOrderId, adminId);

      // Assert
      expect(result.message).toBe('Repair order deleted successfully');
      expect(mockKnex.update).toHaveBeenCalledWith({
        deleted_at: expect.any(Date),
        updated_by: adminId,
      });
    });

    it('should not delete completed repair order', async () => {
      // Arrange
      const repairOrderId = 'repair-order-123';
      const adminId = 'admin-123';
      const mockRepairOrder = RepairOrderFactory.create({
        id: repairOrderId,
        status: 'Completed',
      });

      mockKnex.first.mockResolvedValueOnce(mockRepairOrder);

      // Act & Assert
      await expect(service.remove(repairOrderId, adminId)).rejects.toThrow(
        'Cannot delete completed repair order',
      );
    });
  });

  describe('getRepairOrderStats', () => {
    it('should return repair order statistics', async () => {
      // Arrange
      const mockStats = [
        { status: 'Open', count: '5' },
        { status: 'In Progress', count: '3' },
        { status: 'Completed', count: '10' },
      ];

      mockKnex.raw.mockResolvedValueOnce({ rows: mockStats });

      // Act
      const result = await service.getRepairOrderStats();

      // Assert
      expect(result.data.open_orders).toBe(5);
      expect(result.data.in_progress_orders).toBe(3);
      expect(result.data.completed_orders).toBe(10);
      expect(result.data.total_orders).toBe(18);
    });

    it('should cache statistics', async () => {
      // Arrange
      const mockStats = [{ status: 'Open', count: '5' }];
      mockKnex.raw.mockResolvedValueOnce({ rows: mockStats });
      mockRedis.get.mockResolvedValueOnce(null);

      // Act
      await service.getRepairOrderStats();

      // Assert
      expect(mockRedis.set).toHaveBeenCalledWith(
        'repair_orders:stats',
        expect.any(String),
        'EX',
        1800,
      );
    });
  });

  describe('assignAdmin', () => {
    it('should assign admin to repair order', async () => {
      // Arrange
      const repairOrderId = 'repair-order-123';
      const assignedAdminId = 'admin-456';
      const assigningAdminId = 'admin-123';
      const mockRepairOrder = RepairOrderFactory.create({ id: repairOrderId });

      mockKnex.first.mockResolvedValueOnce(mockRepairOrder);
      mockKnex.update.mockResolvedValueOnce(1);

      // Act
      const result = await service.assignAdmin(repairOrderId, assignedAdminId, assigningAdminId);

      // Assert
      expect(result.message).toBe('Admin assigned successfully');
      expect(mockKnex.update).toHaveBeenCalledWith({
        assigned_admin_id: assignedAdminId,
        updated_by: assigningAdminId,
        updated_at: expect.any(Date),
      });
    });
  });

  describe('changeStatus', () => {
    it('should change repair order status', async () => {
      // Arrange
      const repairOrderId = 'repair-order-123';
      const newStatus = 'Completed';
      const adminId = 'admin-123';
      const mockRepairOrder = RepairOrderFactory.create({
        id: repairOrderId,
        status: 'In Progress',
      });

      mockKnex.first.mockResolvedValueOnce(mockRepairOrder);
      mockKnex.update.mockResolvedValueOnce(1);
      mockKnex.transaction.mockImplementation((callback) => callback(mockKnex));

      // Act
      const result = await service.changeStatus(repairOrderId, newStatus, adminId);

      // Assert
      expect(result.message).toBe('Status changed successfully');
      expect(mockNotificationService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'status_change',
          message: expect.stringContaining('Status changed to Completed'),
        }),
        adminId,
      );
    });

    it('should not allow invalid status transition', async () => {
      // Arrange
      const repairOrderId = 'repair-order-123';
      const newStatus = 'Open';
      const adminId = 'admin-123';
      const mockRepairOrder = RepairOrderFactory.create({
        id: repairOrderId,
        status: 'Completed',
      });

      mockKnex.first.mockResolvedValueOnce(mockRepairOrder);

      // Act & Assert
      await expect(service.changeStatus(repairOrderId, newStatus, adminId)).rejects.toThrow(
        'Invalid status transition',
      );
    });
  });
});
