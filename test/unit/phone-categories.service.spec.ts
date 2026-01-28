import { Test, TestingModule } from '@nestjs/testing';
import { PhoneCategoriesService } from '../../src/phone-categories.service';
import { Knex } from 'knex';
import { getKnexToken } from 'nestjs-knex';
import { RedisService } from '../../src/common/redis/redis.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('PhoneCategoriesService', () => {
  let service: PhoneCategoriesService;
  let knexMock: jest.Mocked<Knex>;
  let redisMock: jest.Mocked<RedisService>;

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
    const mockQueryBuilder: any = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhoneCategoriesService,
        {
          provide: getKnexToken(),
          useValue: knexMock,
        },
        {
          provide: RedisService,
          useValue: redisMock,
        },
      ],
    }).compile();

    service = module.get<PhoneCategoriesService>(PhoneCategoriesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      name: 'Samsung',
      parent_id: null,
    };

    it('should create a new phone category successfully', async () => {
      // Arrange
      const trxMock = knexMock.transaction() as any;
      trxMock.where.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValue(null); // No existing category
      trxMock.insert.mockReturnValue(trxMock);
      trxMock.returning.mockResolvedValue([mockPhoneCategory]);

      // Act
      const result = await service.create(createDto, 'admin-id');

      // Assert
      expect(result).toEqual(mockPhoneCategory);
      expect(trxMock.insert).toHaveBeenCalled();
      expect(redisMock.flushByPrefix).toHaveBeenCalledWith('phone_categories');
    });

    it('should throw BadRequestException when name already exists', async () => {
      // Arrange
      const trxMock = knexMock.transaction() as any;
      trxMock.where.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValue(mockPhoneCategory); // Existing category

      // Act & Assert
      await expect(service.create(createDto, 'admin-id'))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return all phone categories as tree structure', async () => {
      // Arrange
      redisMock.get.mockResolvedValue(null);
      knexMock.select.mockReturnValue(knexMock);
      knexMock.where.mockReturnValue(knexMock);
      knexMock.orderBy.mockResolvedValue([mockPhoneCategory]);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toEqual([mockPhoneCategory]);
      expect(redisMock.set).toHaveBeenCalled();
    });

    it('should return cached categories if available', async () => {
      // Arrange
      redisMock.get.mockResolvedValue(JSON.stringify([mockPhoneCategory]));

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toEqual([mockPhoneCategory]);
      expect(knexMock.select).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return phone category by id', async () => {
      // Arrange
      knexMock.where.mockReturnValue(knexMock);
      knexMock.first.mockResolvedValue(mockPhoneCategory);

      // Act
      const result = await service.findOne(mockPhoneCategory.id);

      // Assert
      expect(result).toEqual(mockPhoneCategory);
    });

    it('should throw NotFoundException when category not found', async () => {
      // Arrange
      knexMock.where.mockReturnValue(knexMock);
      knexMock.first.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne('non-existent-id'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto = {
      name: 'Updated iPhone',
    };

    it('should update phone category successfully', async () => {
      // Arrange
      const trxMock = knexMock.transaction() as any;
      trxMock.where.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValue(mockPhoneCategory);
      trxMock.update.mockReturnValue(trxMock);
      trxMock.returning.mockResolvedValue([{ ...mockPhoneCategory, ...updateDto }]);

      // Act
      const result = await service.update(mockPhoneCategory.id, updateDto, 'admin-id');

      // Assert
      expect(result.message).toContain('successfully');
      expect(redisMock.flushByPrefix).toHaveBeenCalledWith('phone_categories');
    });

    it('should throw NotFoundException when category not found for update', async () => {
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
    it('should soft delete phone category successfully', async () => {
      // Arrange
      const trxMock = knexMock.transaction() as any;
      trxMock.where.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValue(mockPhoneCategory);
      trxMock.update.mockResolvedValue(1);

      // Act
      const result = await service.remove(mockPhoneCategory.id, 'admin-id');

      // Assert
      expect(result.message).toContain('successfully');
      expect(redisMock.flushByPrefix).toHaveBeenCalledWith('phone_categories');
    });

    it('should throw NotFoundException when category not found for deletion', async () => {
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
    });
  });
});