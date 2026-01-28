import { Test, TestingModule } from '@nestjs/testing';
import { ProblemCategoriesService } from '../../src/problem-categories.service';
import { Knex } from 'knex';
import { getKnexToken } from 'nestjs-knex';
import { RedisService } from '../../src/common/redis/redis.service';
import { LoggerService } from '../../src/common/logger/logger.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProblemCategory, ProblemCategoryWithMeta } from '../../src/common/types/problem-category.interface';

jest.mock('src/common/utils/sort.util', () => ({
  getNextSortValue: jest.fn().mockResolvedValue(1),
}));

describe('ProblemCategoriesService', () => {
  let service: ProblemCategoriesService;
  let knexMock: jest.Mocked<Knex>;
  let redisMock: jest.Mocked<RedisService>;
  let loggerMock: jest.Mocked<LoggerService>;

  const mockProblemCategory: ProblemCategory = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name_uz: 'Ekran siniq',
    name_ru: 'Разбитый экран',
    name_en: 'Broken screen',
    parent_id: null,
    price: '50000',
    estimated_minutes: 60,
    sort: 1,
    is_active: true,
    status: 'Open',
    created_at: new Date(),
    updated_at: new Date(),
    created_by: 'admin-id',
  };

  const mockProblemCategoryWithMeta: ProblemCategoryWithMeta = {
    ...mockProblemCategory,
    has_children: false,
    breadcrumb: [],
  };

  beforeEach(async () => {
    const mockQueryBuilder: any = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      whereNot: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      whereRaw: jest.fn().mockReturnThis(),
      orWhereRaw: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      join: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      clone: jest.fn().mockReturnThis(),
      count: jest.fn(),
      first: jest.fn(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn(),
      del: jest.fn(),
      returning: jest.fn(),
    };

    const mockTransaction: any = {
      ...mockQueryBuilder,
      commit: jest.fn(),
      rollback: jest.fn(),
      raw: jest.fn(),
      fn: {
        now: jest.fn().mockReturnValue(new Date()),
      },
    };

    knexMock = {
      transaction: jest.fn().mockResolvedValue(mockTransaction),
      raw: jest.fn(),
      fn: {
        now: jest.fn().mockReturnValue(new Date()),
      },
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
        ProblemCategoriesService,
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

    service = module.get<ProblemCategoriesService>(ProblemCategoriesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      name_uz: 'Yangi muammo',
      name_ru: 'Новая проблема',
      name_en: 'New problem',
      phone_category_id: 'phone-cat-1',
      price: 25000,
      estimated_minutes: 30,
    };

    it('should create root problem category successfully', async () => {
      // Arrange
      const trxMock = await knexMock.transaction();
      trxMock.where.mockReturnValue(trxMock);
      trxMock.andWhere.mockReturnValue(trxMock);
      trxMock.join.mockReturnValue(trxMock);
      trxMock.leftJoin.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValueOnce(null) // No parent check needed
                   .mockResolvedValueOnce(null) // No isParent
                   .mockResolvedValueOnce(null); // No existing
      trxMock.insert.mockReturnValue(trxMock);
      trxMock.returning.mockResolvedValue([mockProblemCategory]);

      // Act
      const result = await service.create(createDto, 'admin-id');

      // Assert
      expect(result).toEqual(mockProblemCategory);
      expect(trxMock.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          name_uz: 'Yangi muammo',
          name_ru: 'Новая проблема',
          name_en: 'New problem',
          price: '25000',
          estimated_minutes: 30,
        })
      );
      expect(redisMock.flushByPrefix).toHaveBeenCalledWith('problem_categories:');
      expect(trxMock.commit).toHaveBeenCalled();
    });

    it('should throw BadRequestException when both parent_id and phone_category_id provided', async () => {
      // Arrange
      const invalidDto = {
        ...createDto,
        parent_id: 'parent-1',
        phone_category_id: 'phone-1',
      };

      // Act & Assert
      await expect(service.create(invalidDto, 'admin-id'))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when neither parent_id nor phone_category_id provided', async () => {
      // Arrange
      const invalidDto = {
        name_uz: 'Test',
        name_ru: 'Test',
        name_en: 'Test',
      };

      // Act & Assert
      await expect(service.create(invalidDto, 'admin-id'))
        .rejects.toThrow(BadRequestException);
    });

    it('should create child problem category successfully', async () => {
      // Arrange
      const childDto = {
        ...createDto,
        parent_id: 'parent-1',
        phone_category_id: undefined,
      };

      const trxMock = await knexMock.transaction();
      trxMock.where.mockReturnValue(trxMock);
      trxMock.andWhere.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValueOnce(mockProblemCategory) // Parent exists
                   .mockResolvedValueOnce(null); // No existing child
      trxMock.insert.mockReturnValue(trxMock);
      trxMock.returning.mockResolvedValue([{ ...mockProblemCategory, parent_id: 'parent-1' }]);

      // Act
      const result = await service.create(childDto, 'admin-id');

      // Assert
      expect(result.parent_id).toBe('parent-1');
      expect(trxMock.commit).toHaveBeenCalled();
    });
  });

  describe('findRootProblems', () => {
    const query = {
      phone_category_id: 'phone-cat-1',
      search: 'screen',
      limit: 10,
      offset: 0,
    };

    it('should return cached results when available', async () => {
      // Arrange
      const cachedResult = {
        rows: [mockProblemCategoryWithMeta],
        total: 1,
        limit: 10,
        offset: 0,
      };
      redisMock.get.mockResolvedValue(cachedResult);

      // Act
      const result = await service.findRootProblems(query);

      // Assert
      expect(result).toEqual(cachedResult);
      expect(loggerMock.debug).toHaveBeenCalledWith(expect.stringContaining('Cache hit'));
    });

    it('should fetch from database and cache when not cached', async () => {
      // Arrange
      redisMock.get.mockResolvedValue(null);
      const trxMock = await knexMock.transaction();
      trxMock.select.mockReturnValue(trxMock);
      trxMock.leftJoin.mockReturnValue(trxMock);
      trxMock.where.mockReturnValue(trxMock);
      trxMock.andWhere.mockReturnValue(trxMock);
      trxMock.clone.mockReturnValue(trxMock);
      trxMock.orderBy.mockReturnValue(trxMock);
      trxMock.offset.mockReturnValue(trxMock);
      trxMock.limit.mockResolvedValue([mockProblemCategoryWithMeta]);
      trxMock.count.mockResolvedValue([{ count: '1' }]);

      // Act
      const result = await service.findRootProblems(query);

      // Assert
      expect(result.rows).toEqual([mockProblemCategoryWithMeta]);
      expect(result.total).toBe(1);
      expect(redisMock.set).toHaveBeenCalledWith(
        expect.any(String),
        result,
        3600
      );
      expect(trxMock.commit).toHaveBeenCalled();
    });

    it('should throw BadRequestException when phone_category_id not provided', async () => {
      // Arrange
      const invalidQuery = { ...query, phone_category_id: undefined };

      // Act & Assert
      await expect(service.findRootProblems(invalidQuery))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('findChildrenWithBreadcrumb', () => {
    const query = {
      parent_id: 'parent-1',
      search: 'broken',
      limit: 10,
      offset: 0,
    };

    it('should return cached children with breadcrumb', async () => {
      // Arrange
      const cachedResult = {
        rows: [mockProblemCategoryWithMeta],
        total: 1,
        limit: 10,
        offset: 0,
      };
      redisMock.get.mockResolvedValue(cachedResult);

      // Act
      const result = await service.findChildrenWithBreadcrumb(query);

      // Assert
      expect(result).toEqual(cachedResult);
    });

    it('should throw BadRequestException when parent_id not provided', async () => {
      // Arrange
      const invalidQuery = { ...query, parent_id: undefined };

      // Act & Assert
      await expect(service.findChildrenWithBreadcrumb(invalidQuery))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    const updateDto = {
      name_uz: 'Updated name',
      name_ru: 'Обновленное название',
      name_en: 'Updated name',
      price: '75000',
    };

    it('should update problem category successfully', async () => {
      // Arrange
      const trxMock = await knexMock.transaction();
      trxMock.where.mockReturnValue(trxMock);
      trxMock.whereNot.mockReturnValue(trxMock);
      trxMock.andWhere.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValueOnce(mockProblemCategory) // Category exists
                   .mockResolvedValueOnce(null); // No conflict
      trxMock.update.mockResolvedValue(1);

      // Act
      const result = await service.update(mockProblemCategory.id, updateDto);

      // Assert
      expect(result).toEqual({ message: 'Problem category updated successfully' });
      expect(trxMock.update).toHaveBeenCalledWith(
        expect.objectContaining(updateDto)
      );
      expect(redisMock.flushByPrefix).toHaveBeenCalledWith('problem_categories:');
      expect(trxMock.commit).toHaveBeenCalled();
    });

    it('should throw BadRequestException when category not found', async () => {
      // Arrange
      const trxMock = await knexMock.transaction();
      trxMock.where.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update('non-existent', updateDto))
        .rejects.toThrow(BadRequestException);
      expect(trxMock.rollback).toHaveBeenCalled();
    });
  });

  describe('updateSort', () => {
    it('should update sort order successfully', async () => {
      // Arrange
      const trxMock = await knexMock.transaction();
      trxMock.where.mockReturnValue(trxMock);
      trxMock.andWhere.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValue(mockProblemCategory);
      trxMock.update.mockResolvedValue(1);

      // Act
      const result = await service.updateSort(mockProblemCategory.id, 5);

      // Assert
      expect(result).toEqual({ message: 'Sort updated successfully' });
      expect(trxMock.commit).toHaveBeenCalled();
    });

    it('should return no change message when sort is same', async () => {
      // Arrange
      const trxMock = await knexMock.transaction();
      trxMock.where.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValue(mockProblemCategory);

      // Act
      const result = await service.updateSort(mockProblemCategory.id, mockProblemCategory.sort);

      // Assert
      expect(result).toEqual({ message: 'No change needed' });
      expect(trxMock.commit).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should soft delete problem category successfully', async () => {
      // Arrange
      const trxMock = await knexMock.transaction();
      trxMock.where.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValueOnce(mockProblemCategory) // Category exists
                   .mockResolvedValueOnce(null); // No children
      trxMock.update.mockResolvedValue(1);
      trxMock.del.mockResolvedValue(1);

      // Act
      const result = await service.delete(mockProblemCategory.id);

      // Assert
      expect(result).toEqual({ message: 'Problem category deleted successfully' });
      expect(trxMock.update).toHaveBeenCalledWith({
        status: 'Deleted',
        updated_at: expect.any(String),
      });
      expect(redisMock.flushByPrefix).toHaveBeenCalledWith('problem_categories:');
      expect(trxMock.commit).toHaveBeenCalled();
    });

    it('should throw NotFoundException when category not found', async () => {
      // Arrange
      const trxMock = await knexMock.transaction();
      trxMock.where.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValue(null);

      // Act & Assert
      await expect(service.delete('non-existent'))
        .rejects.toThrow(NotFoundException);
      expect(trxMock.rollback).toHaveBeenCalled();
    });

    it('should throw BadRequestException when category has children', async () => {
      // Arrange
      const trxMock = await knexMock.transaction();
      trxMock.where.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValueOnce(mockProblemCategory) // Category exists
                   .mockResolvedValueOnce(mockProblemCategory); // Has children

      // Act & Assert
      await expect(service.delete(mockProblemCategory.id))
        .rejects.toThrow(BadRequestException);
      expect(trxMock.rollback).toHaveBeenCalled();
    });
  });
});