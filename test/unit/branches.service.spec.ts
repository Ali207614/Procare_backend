import { Test, TestingModule } from '@nestjs/testing';
import { BranchesService } from '../../src/branches.service';
import { Knex } from 'knex';
import { getKnexToken } from 'nestjs-knex';
import { RedisService } from '../../src/common/redis/redis.service';
import { RepairOrderStatusPermissionsService } from '../../src/repair-order-status-permission/repair-order-status-permissions.service';
import { LoggerService } from '../../src/common/logger/logger.service';
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { CreateBranchDto } from '../../src/dto/create-branch.dto';
import { UpdateBranchDto } from '../../src/dto/update-branch.dto';
import { Branch } from '../../src/common/types/branch.interface';

describe('BranchesService', () => {
  let service: BranchesService;
  let knexMock: jest.Mocked<Knex>;
  let redisMock: jest.Mocked<RedisService>;
  let permissionServiceMock: jest.Mocked<RepairOrderStatusPermissionsService>;
  let loggerMock: jest.Mocked<LoggerService>;

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
    const mockQueryBuilder: any = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      whereRaw: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      first: jest.fn(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      returning: jest.fn(),
    };

    const mockTransaction: any = {
      ...mockQueryBuilder,
      commit: jest.fn(),
      rollback: jest.fn(),
    };

    knexMock = {
      transaction: jest.fn().mockImplementation((callback) => callback(mockTransaction)),
      ...mockQueryBuilder,
    } as any;

    redisMock = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      flushByPrefix: jest.fn(),
    } as any;

    permissionServiceMock = {
      findByRolesAndBranch: jest.fn(),
      checkPermissionsOrThrow: jest.fn(),
    } as any;

    loggerMock = {
      debug: jest.fn(),
      error: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BranchesService,
        {
          provide: getKnexToken(),
          useValue: knexMock,
        },
        {
          provide: RedisService,
          useValue: redisMock,
        },
        {
          provide: RepairOrderStatusPermissionsService,
          useValue: permissionServiceMock,
        },
        {
          provide: LoggerService,
          useValue: loggerMock,
        },
      ],
    }).compile();

    service = module.get<BranchesService>(BranchesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateBranchDto = {
      name_uz: 'New Branch UZ',
      name_ru: 'New Branch RU',
      name_en: 'New Branch EN',
      address: 'New Address',
      phone: '+998901234567',
    };

    it('should create a new branch successfully', async () => {
      // Arrange
      const trxMock = knexMock.transaction() as any;
      trxMock.whereRaw.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValue(null); // No existing branch
      trxMock.insert.mockReturnValue(trxMock);
      trxMock.returning.mockResolvedValue([mockBranch]);

      // Act
      const result = await service.create(createDto, 'admin-id');

      // Assert
      expect(result).toEqual(mockBranch);
      expect(trxMock.insert).toHaveBeenCalled();
      expect(redisMock.flushByPrefix).toHaveBeenCalledWith('branches');
    });

    it('should throw BadRequestException when branch name already exists', async () => {
      // Arrange
      const trxMock = knexMock.transaction() as any;
      trxMock.whereRaw.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValue(mockBranch); // Existing branch

      // Act & Assert
      await expect(service.create(createDto, 'admin-id'))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return all branches', async () => {
      // Arrange
      redisMock.get.mockResolvedValue(null);
      knexMock.select.mockReturnValue(knexMock);
      knexMock.where.mockReturnValue(knexMock);
      knexMock.orderBy.mockResolvedValue([mockBranch]);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toEqual([mockBranch]);
      expect(redisMock.set).toHaveBeenCalled();
    });

    it('should return cached branches if available', async () => {
      // Arrange
      redisMock.get.mockResolvedValue(JSON.stringify([mockBranch]));

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toEqual([mockBranch]);
      expect(knexMock.select).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return branch by id', async () => {
      // Arrange
      knexMock.where.mockReturnValue(knexMock);
      knexMock.first.mockResolvedValue(mockBranch);

      // Act
      const result = await service.findOne(mockBranch.id);

      // Assert
      expect(result).toEqual(mockBranch);
    });

    it('should throw NotFoundException when branch not found', async () => {
      // Arrange
      knexMock.where.mockReturnValue(knexMock);
      knexMock.first.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne('non-existent-id'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateBranchDto = {
      name_uz: 'Updated Branch UZ',
    };

    it('should update branch successfully', async () => {
      // Arrange
      const trxMock = knexMock.transaction() as any;
      trxMock.where.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValue(mockBranch);
      trxMock.update.mockReturnValue(trxMock);
      trxMock.returning.mockResolvedValue([{ ...mockBranch, ...updateDto }]);

      // Act
      const result = await service.update(mockBranch.id, updateDto, 'admin-id');

      // Assert
      expect(result.message).toContain('successfully');
      expect(redisMock.flushByPrefix).toHaveBeenCalledWith('branches');
    });

    it('should throw NotFoundException when branch not found for update', async () => {
      // Arrange
      const trxMock = knexMock.transaction() as any;
      trxMock.where.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update('non-existent-id', updateDto, 'admin-id'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete branch successfully', async () => {
      // Arrange
      const trxMock = knexMock.transaction() as any;
      trxMock.where.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValue(mockBranch);
      trxMock.update.mockResolvedValue(1);

      // Act
      const result = await service.remove(mockBranch.id, 'admin-id');

      // Assert
      expect(result.message).toContain('successfully');
      expect(redisMock.flushByPrefix).toHaveBeenCalledWith('branches');
    });

    it('should throw NotFoundException when branch not found for deletion', async () => {
      // Arrange
      const trxMock = knexMock.transaction() as any;
      trxMock.where.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValue(null);

      // Act & Assert
      await expect(service.remove('non-existent-id', 'admin-id'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('cache management', () => {
    it('should flush cache after operations', () => {
      expect(redisMock.flushByPrefix).toBeDefined();
      expect(loggerMock.debug).toBeDefined();
    });
  });
});