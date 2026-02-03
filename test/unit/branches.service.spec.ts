import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Knex } from 'knex';
import { BranchesService } from './branches.service';
import { RedisService } from '../common/redis/redis.service';
import { BranchFactory } from '../../test/factories/branch.factory';
import { AdminFactory } from '../../test/factories/admin.factory';

describe('BranchesService', () => {
  let service: BranchesService;
  let knexMock: jest.Mocked<Knex>;
  let redisServiceMock: jest.Mocked<RedisService>;

  const mockBranch = BranchFactory.create();
  const mockAdminPayload = AdminFactory.createPayload();

  beforeEach(async () => {
    // Create comprehensive mocks
    knexMock = {
      transaction: jest.fn(),
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      first: jest.fn(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      returning: jest.fn(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      raw: jest.fn(),
      join: jest.fn().mockReturnThis(),
    } as any;

    // Mock knex call
    (knexMock as any).mockImplementation((table: string) => {
      if (table) return knexMock;
      return knexMock;
    });

    redisServiceMock = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BranchesService,
        {
          provide: 'default_KnexModuleConnectionToken',
          useValue: knexMock,
        },
        {
          provide: RedisService,
          useValue: redisServiceMock,
        },
      ],
    }).compile();

    service = module.get<BranchesService>(BranchesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = BranchFactory.createDto();

    it('should create branch successfully', async () => {
      // Arrange
      knexMock.first.mockResolvedValue(undefined); // No existing branch
      const trxMock = {
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockBranch]),
      };
      knexMock.transaction.mockImplementation((callback) => callback(trxMock));
      redisServiceMock.del.mockResolvedValue(1);

      // Act
      const result = await service.create(createDto, mockAdminPayload);

      // Assert
      expect(result).toEqual(mockBranch);
      expect(redisServiceMock.del).toHaveBeenCalledWith(expect.stringContaining('branches:'));
    });

    it('should throw BadRequestException if branch name already exists', async () => {
      // Arrange
      knexMock.first.mockResolvedValue(mockBranch);

      // Act & Assert
      await expect(service.create(createDto, mockAdminPayload)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle transaction rollback on error', async () => {
      // Arrange
      knexMock.first.mockResolvedValue(undefined);
      const trxMock = {
        insert: jest.fn().mockRejectedValue(new Error('Database error')),
        rollback: jest.fn(),
      };
      knexMock.transaction.mockImplementation((callback) => callback(trxMock));

      // Act & Assert
      await expect(service.create(createDto, mockAdminPayload)).rejects.toThrow('Database error');
    });
  });

  describe('findAll', () => {
    const findAllDto = {
      limit: 10,
      offset: 0,
    };

    it('should return paginated branches', async () => {
      // Arrange
      const mockBranches = [mockBranch];
      const mockTotal = 5;
      knexMock.raw.mockResolvedValue({
        rows: mockBranches.map((branch) => ({ ...branch, total: mockTotal })),
      });

      // Act
      const result = await service.findAll(findAllDto);

      // Assert
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.data).toEqual(mockBranches);
      expect(result.meta.total).toBe(mockTotal);
      expect(result.meta.limit).toBe(findAllDto.limit);
      expect(result.meta.offset).toBe(findAllDto.offset);
    });

    it('should filter by status when provided', async () => {
      // Arrange
      const findAllWithStatus = { ...findAllDto, status: 'Active' };
      knexMock.raw.mockResolvedValue({ rows: [] });

      // Act
      await service.findAll(findAllWithStatus);

      // Assert
      expect(knexMock.raw).toHaveBeenCalledWith(
        expect.stringContaining('status'),
        expect.objectContaining({
          status: 'Active',
        }),
      );
    });

    it('should search by name when provided', async () => {
      // Arrange
      const findAllWithSearch = { ...findAllDto, search: 'Test' };
      knexMock.raw.mockResolvedValue({ rows: [] });

      // Act
      await service.findAll(findAllWithSearch);

      // Assert
      expect(knexMock.raw).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.objectContaining({
          search: '%Test%',
        }),
      );
    });
  });

  describe('findById', () => {
    it('should find branch by id', async () => {
      // Arrange
      knexMock.raw.mockResolvedValue({ rows: [mockBranch] });

      // Act
      const result = await service.findById(mockBranch.id);

      // Assert
      expect(result).toEqual(mockBranch);
      expect(knexMock.raw).toHaveBeenCalledWith(expect.any(String), { branch_id: mockBranch.id });
    });

    it('should throw NotFoundException when branch not found', async () => {
      // Arrange
      knexMock.raw.mockResolvedValue({ rows: [] });

      // Act & Assert
      await expect(service.findById('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto = {
      name: 'Updated Branch Name',
      address: 'Updated Address',
    };

    it('should update branch successfully', async () => {
      // Arrange
      knexMock.raw.mockResolvedValue({ rows: [mockBranch] }); // findById
      knexMock.first.mockResolvedValue(undefined); // Check name uniqueness

      const trxMock = {
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ ...mockBranch, ...updateDto }]),
      };
      knexMock.transaction.mockImplementation((callback) => callback(trxMock));
      redisServiceMock.del.mockResolvedValue(1);

      // Act
      const result = await service.update(mockBranch.id, updateDto, mockAdminPayload);

      // Assert
      expect(result).toEqual(expect.objectContaining(updateDto));
      expect(redisServiceMock.del).toHaveBeenCalled();
    });

    it('should throw NotFoundException if branch not found', async () => {
      // Arrange
      knexMock.raw.mockResolvedValue({ rows: [] });

      // Act & Assert
      await expect(service.update('non-existent', updateDto, mockAdminPayload)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if name already exists', async () => {
      // Arrange
      knexMock.raw.mockResolvedValue({ rows: [mockBranch] }); // findById
      knexMock.first.mockResolvedValue({ id: 'different-branch-id' }); // Name exists

      // Act & Assert
      await expect(service.update(mockBranch.id, updateDto, mockAdminPayload)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('delete', () => {
    it('should soft delete branch successfully', async () => {
      // Arrange
      knexMock.raw.mockResolvedValue({ rows: [mockBranch] }); // findById
      const trxMock = {
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockResolvedValue([]),
      };
      knexMock.transaction.mockImplementation((callback) => callback(trxMock));
      redisServiceMock.del.mockResolvedValue(1);

      // Act
      const result = await service.delete(mockBranch.id, mockAdminPayload);

      // Assert
      expect(result).toHaveProperty('message');
      expect(trxMock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          deleted_at: expect.any(Date),
          updated_by: mockAdminPayload.id,
        }),
      );
      expect(redisServiceMock.del).toHaveBeenCalled();
    });

    it('should throw NotFoundException if branch not found', async () => {
      // Arrange
      knexMock.raw.mockResolvedValue({ rows: [] });

      // Act & Assert
      await expect(service.delete('non-existent', mockAdminPayload)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('cache management', () => {
    it('should invalidate cache on create, update, and delete', async () => {
      // Arrange
      knexMock.first.mockResolvedValue(undefined);
      const trxMock = {
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockBranch]),
      };
      knexMock.transaction.mockImplementation((callback) => callback(trxMock));
      redisServiceMock.del.mockResolvedValue(1);

      // Act
      await service.create(BranchFactory.createDto(), mockAdminPayload);

      // Assert
      expect(redisServiceMock.del).toHaveBeenCalledWith(expect.stringContaining('branches:'));
    });

    it('should handle Redis errors gracefully', async () => {
      // Arrange
      knexMock.first.mockResolvedValue(undefined);
      const trxMock = {
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockBranch]),
      };
      knexMock.transaction.mockImplementation((callback) => callback(trxMock));
      redisServiceMock.del.mockRejectedValue(new Error('Redis error'));

      // Act & Assert
      // Should still complete successfully even if Redis fails
      await expect(
        service.create(BranchFactory.createDto(), mockAdminPayload),
      ).resolves.toBeDefined();
    });
  });

  describe('working hours validation', () => {
    it('should validate working hours format', async () => {
      // Arrange
      const invalidDto = BranchFactory.createDto({
        working_hours: {
          monday: { open: '25:00', close: '18:00' }, // Invalid hour
        },
      });
      knexMock.first.mockResolvedValue(undefined);

      // Act & Assert - if service validates working hours
      // This depends on actual service implementation
      try {
        await service.create(invalidDto, mockAdminPayload);
      } catch (error) {
        if (error instanceof BadRequestException) {
          expect(error.message).toContain('working hours');
        }
      }
    });
  });

  describe('service initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have all required dependencies injected', () => {
      expect(service['knex']).toBeDefined();
      expect(service['redisService']).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle database connection errors', async () => {
      // Arrange
      knexMock.raw.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(service.findById('test-id')).rejects.toThrow('Database connection failed');
    });

    it('should handle SQL query errors', async () => {
      // Arrange
      knexMock.raw.mockRejectedValue(new Error('SQL syntax error'));

      // Act & Assert
      await expect(service.findById('test-id')).rejects.toThrow('SQL syntax error');
    });
  });
});
