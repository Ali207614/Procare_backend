import { Test, TestingModule } from '@nestjs/testing';
import { PhoneOsTypesService } from '../../src/phone-os-types.service';
import { Knex } from 'knex';
import { getKnexToken } from 'nestjs-knex';
import { RedisService } from '../../src/common/redis/redis.service';
import { LoggerService } from '../../src/common/logger/logger.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PhoneOsType } from '../../src/common/types/phone-os-type.interface';

describe('PhoneOsTypesService', () => {
  let service: PhoneOsTypesService;
  let knexMock: jest.Mocked<Knex>;
  let redisMock: jest.Mocked<RedisService>;
  let loggerMock: jest.Mocked<LoggerService>;

  const mockPhoneOsType: PhoneOsType = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name_uz: 'iOS',
    name_ru: 'iOS',
    name_en: 'iOS',
    is_active: true,
    status: 'Open',
    sort: 1,
    created_at: new Date(),
    updated_at: new Date(),
    created_by: 'admin-id',
  };

  beforeEach(async () => {
    const mockQueryBuilder: any = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      whereNot: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      clone: jest.fn().mockReturnThis(),
      count: jest.fn(),
      first: jest.fn(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn(),
      returning: jest.fn(),
    };

    const mockTransaction: any = {
      ...mockQueryBuilder,
      commit: jest.fn(),
      rollback: jest.fn(),
      destroy: jest.fn(),
      fn: {
        now: jest.fn().mockReturnValue(new Date()),
      },
    };

    knexMock = {
      transaction: jest.fn().mockResolvedValue(mockTransaction),
      ...mockQueryBuilder,
    } as any;

    redisMock = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      flushByPrefix: jest.fn(),
    } as any;

    loggerMock = {
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhoneOsTypesService,
        {
          provide: getKnexToken(),
          useValue: knexMock,
        },
        {
          provide: RedisService,
          useValue: redisMock,
        },
        {
          provide: LoggerService,
          useValue: loggerMock,
        },
      ],
    }).compile();

    service = module.get<PhoneOsTypesService>(PhoneOsTypesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      name_uz: 'Android',
      name_ru: 'Андройд',
      name_en: 'Android',
    };

    it('should create phone OS type successfully', async () => {
      // Arrange
      const trxMock = await knexMock.transaction();
      trxMock.where.mockReturnValue(trxMock);
      trxMock.andWhere.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValue(null); // No conflict
      trxMock.insert.mockReturnValue(trxMock);
      trxMock.returning.mockResolvedValue([mockPhoneOsType]);

      // Act
      const result = await service.create(createDto, 'admin-id');

      // Assert
      expect(result).toEqual(mockPhoneOsType);
      expect(trxMock.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          name_uz: 'Android',
          name_ru: 'Андройд',
          name_en: 'Android',
          created_by: 'admin-id',
          status: 'Open',
        })
      );
      expect(redisMock.del).toHaveBeenCalledWith('phone_os_types:all');
      expect(trxMock.commit).toHaveBeenCalled();
    });

    it('should throw BadRequestException when name conflict exists', async () => {
      // Arrange
      const trxMock = await knexMock.transaction();
      trxMock.where.mockReturnValue(trxMock);
      trxMock.andWhere.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValue(mockPhoneOsType); // Conflict found

      // Act & Assert
      await expect(service.create(createDto, 'admin-id'))
        .rejects.toThrow(BadRequestException);
      expect(trxMock.rollback).toHaveBeenCalled();
    });

    it('should throw BadRequestException when names are empty', async () => {
      // Arrange
      const invalidDto = {
        name_uz: '   ',
        name_ru: '',
        name_en: 'Android',
      };

      const trxMock = await knexMock.transaction();

      // Act & Assert
      await expect(service.create(invalidDto, 'admin-id'))
        .rejects.toThrow(BadRequestException);
      expect(trxMock.rollback).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    const query = { limit: 10, offset: 0 };

    it('should return cached results when available', async () => {
      // Arrange
      const cachedResult = {
        rows: [mockPhoneOsType],
        total: 1,
        limit: 10,
        offset: 0,
      };
      redisMock.get.mockResolvedValue(cachedResult);

      // Act
      const result = await service.findAll(query);

      // Assert
      expect(result).toEqual(cachedResult);
      expect(knexMock.transaction).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache when not cached', async () => {
      // Arrange
      redisMock.get.mockResolvedValue(null);
      const trxMock = await knexMock.transaction();
      trxMock.where.mockReturnValue(trxMock);
      trxMock.clone.mockReturnValue(trxMock);
      trxMock.orderBy.mockReturnValue(trxMock);
      trxMock.offset.mockReturnValue(trxMock);
      trxMock.limit.mockResolvedValue([mockPhoneOsType]);
      trxMock.count.mockResolvedValue([{ count: '1' }]);

      // Act
      const result = await service.findAll(query);

      // Assert
      expect(result.rows).toEqual([mockPhoneOsType]);
      expect(result.total).toBe(1);
      expect(redisMock.set).toHaveBeenCalledWith(
        'phone_os_types:all:0:10',
        result,
        3600
      );
      expect(trxMock.commit).toHaveBeenCalled();
      expect(trxMock.destroy).toHaveBeenCalled();
    });

    it('should use default pagination values', async () => {
      // Arrange
      redisMock.get.mockResolvedValue(null);
      const trxMock = await knexMock.transaction();
      trxMock.where.mockReturnValue(trxMock);
      trxMock.clone.mockReturnValue(trxMock);
      trxMock.orderBy.mockReturnValue(trxMock);
      trxMock.offset.mockReturnValue(trxMock);
      trxMock.limit.mockResolvedValue([]);
      trxMock.count.mockResolvedValue([{ count: '0' }]);

      // Act
      const result = await service.findAll({});

      // Assert
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });
  });

  describe('update', () => {
    const updateDto = {
      name_uz: 'Updated iOS',
      name_ru: 'Обновленный iOS',
      name_en: 'Updated iOS',
    };

    it('should update phone OS type successfully', async () => {
      // Arrange
      const trxMock = await knexMock.transaction();
      trxMock.where.mockReturnValue(trxMock);
      trxMock.whereNot.mockReturnValue(trxMock);
      trxMock.andWhere.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValueOnce(mockPhoneOsType) // Exists check
                   .mockResolvedValueOnce(null); // No conflict
      trxMock.update.mockResolvedValue(1);

      // Act
      const result = await service.update(mockPhoneOsType.id, updateDto);

      // Assert
      expect(result).toEqual({ message: 'Phone OS type updated successfully' });
      expect(trxMock.update).toHaveBeenCalledWith(
        expect.objectContaining(updateDto)
      );
      expect(redisMock.del).toHaveBeenCalledWith('phone_os_types:all');
      expect(trxMock.commit).toHaveBeenCalled();
    });

    it('should throw NotFoundException when OS type not found', async () => {
      // Arrange
      const trxMock = await knexMock.transaction();
      trxMock.where.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update('non-existent-id', updateDto))
        .rejects.toThrow(NotFoundException);
      expect(trxMock.rollback).toHaveBeenCalled();
    });

    it('should throw BadRequestException when name conflict exists', async () => {
      // Arrange
      const trxMock = await knexMock.transaction();
      trxMock.where.mockReturnValue(trxMock);
      trxMock.whereNot.mockReturnValue(trxMock);
      trxMock.andWhere.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValueOnce(mockPhoneOsType) // Exists
                   .mockResolvedValueOnce(mockPhoneOsType); // Conflict

      // Act & Assert
      await expect(service.update(mockPhoneOsType.id, updateDto))
        .rejects.toThrow(BadRequestException);
      expect(trxMock.rollback).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should soft delete phone OS type successfully', async () => {
      // Arrange
      const trxMock = await knexMock.transaction();
      trxMock.where.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValueOnce(mockPhoneOsType) // Exists
                   .mockResolvedValueOnce(null); // No related categories
      trxMock.update.mockResolvedValue(1);

      // Act
      const result = await service.delete(mockPhoneOsType.id);

      // Assert
      expect(result).toEqual({ message: 'Phone OS type deleted (soft) successfully' });
      expect(trxMock.update).toHaveBeenCalledWith({
        status: 'Deleted',
        updated_at: expect.any(Date),
      });
      expect(redisMock.del).toHaveBeenCalledWith('phone_os_types:all');
      expect(trxMock.commit).toHaveBeenCalled();
    });

    it('should throw NotFoundException when OS type not found', async () => {
      // Arrange
      const trxMock = await knexMock.transaction();
      trxMock.where.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValue(null);

      // Act & Assert
      await expect(service.delete('non-existent-id'))
        .rejects.toThrow(NotFoundException);
      expect(trxMock.rollback).toHaveBeenCalled();
    });

    it('should throw BadRequestException when has related categories', async () => {
      // Arrange
      const trxMock = await knexMock.transaction();
      trxMock.where.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValueOnce(mockPhoneOsType) // Exists
                   .mockResolvedValueOnce({ id: 'category-1' }); // Has related

      // Act & Assert
      await expect(service.delete(mockPhoneOsType.id))
        .rejects.toThrow(BadRequestException);
      expect(trxMock.rollback).toHaveBeenCalled();
    });
  });
});