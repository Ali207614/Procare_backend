import { Test, TestingModule } from '@nestjs/testing';
import { RepairPartsService } from '../../src/repair-parts.service';
import { Knex } from 'knex';
import { getKnexToken } from 'nestjs-knex';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RepairPart } from '../../src/common/types/repair-part.interface';

describe('RepairPartsService', () => {
  let service: RepairPartsService;
  let knexMock: jest.Mocked<Knex>;

  const mockRepairPart: RepairPart = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    part_name_uz: 'Ekran',
    part_name_ru: 'Экран',
    part_name_en: 'Screen',
    part_code: 'SCR001',
    manufacturer: 'Samsung',
    price: '125000',
    stock_quantity: 50,
    min_stock_level: 10,
    is_active: true,
    status: 'Open',
    created_at: new Date(),
    updated_at: new Date(),
    created_by: 'admin-id',
  };

  beforeEach(async () => {
    const mockQueryBuilder: any = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      whereNot: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      whereRaw: jest.fn().mockReturnThis(),
      orWhereRaw: jest.fn().mockReturnThis(),
      whereNotExists: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      clone: jest.fn().mockReturnThis(),
      clearSelect: jest.fn().mockReturnThis(),
      clearOrder: jest.fn().mockReturnThis(),
      countDistinct: jest.fn(),
      count: jest.fn(),
      first: jest.fn(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn(),
      returning: jest.fn(),
      raw: jest.fn(),
      from: jest.fn().mockReturnThis(),
    };

    knexMock = {
      ...mockQueryBuilder,
      fn: {
        now: jest.fn().mockReturnValue(new Date()),
      },
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepairPartsService,
        {
          provide: getKnexToken(),
          useValue: knexMock,
        },
      ],
    }).compile();

    service = module.get<RepairPartsService>(RepairPartsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      part_name_uz: 'Batareya',
      part_name_ru: 'Батарея',
      part_name_en: 'Battery',
      part_code: 'BAT001',
      manufacturer: 'Apple',
      price: '85000',
      stock_quantity: 25,
      min_stock_level: 5,
    };

    it('should create repair part successfully', async () => {
      // Arrange
      knexMock.where.mockReturnValue(knexMock);
      knexMock.andWhere.mockReturnValue(knexMock);
      knexMock.first.mockResolvedValue(null); // No existing part
      knexMock.insert.mockReturnValue(knexMock);
      knexMock.returning.mockResolvedValue([mockRepairPart]);

      // Act
      const result = await service.create(createDto, 'admin-id');

      // Assert
      expect(result).toEqual(mockRepairPart);
      expect(knexMock.insert).toHaveBeenCalledWith({
        ...createDto,
        created_by: 'admin-id',
        status: 'Open',
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      });
    });

    it('should throw BadRequestException when part name already exists', async () => {
      // Arrange
      knexMock.where.mockReturnValue(knexMock);
      knexMock.andWhere.mockReturnValue(knexMock);
      knexMock.first.mockResolvedValue(mockRepairPart); // Existing part found

      // Act & Assert
      await expect(service.create(createDto, 'admin-id'))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    const query = {
      limit: 10,
      offset: 0,
      search: 'screen',
      status: 'Open',
      problem_category_ids: ['cat-1', 'cat-2'],
    };

    it('should return paginated repair parts with filters', async () => {
      // Arrange
      knexMock.leftJoin.mockReturnValue(knexMock);
      knexMock.whereNot.mockReturnValue(knexMock);
      knexMock.andWhere.mockReturnValue(knexMock);
      knexMock.whereIn.mockReturnValue(knexMock);
      knexMock.clone.mockReturnValue(knexMock);
      knexMock.select.mockReturnValue(knexMock);
      knexMock.orderBy.mockReturnValue(knexMock);
      knexMock.offset.mockReturnValue(knexMock);
      knexMock.limit.mockResolvedValue([mockRepairPart]);
      knexMock.clearSelect.mockReturnValue(knexMock);
      knexMock.clearOrder.mockReturnValue(knexMock);
      knexMock.countDistinct.mockResolvedValue([{ count: '1' }]);

      // Act
      const result = await service.findAll(query);

      // Assert
      expect(result.rows).toEqual([mockRepairPart]);
      expect(result.total).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(0);
      expect(knexMock.andWhere).toHaveBeenCalledWith('rp.status', 'Open');
    });

    it('should exclude specific problem category IDs', async () => {
      // Arrange
      const queryWithExclude = {
        ...query,
        problem_category_ids: undefined,
        exclude_problem_category_ids: ['cat-3', 'cat-4'],
      };

      knexMock.leftJoin.mockReturnValue(knexMock);
      knexMock.whereNot.mockReturnValue(knexMock);
      knexMock.andWhere.mockReturnValue(knexMock);
      knexMock.whereNotExists.mockReturnValue(knexMock);
      knexMock.clone.mockReturnValue(knexMock);
      knexMock.select.mockReturnValue(knexMock);
      knexMock.orderBy.mockReturnValue(knexMock);
      knexMock.offset.mockReturnValue(knexMock);
      knexMock.limit.mockResolvedValue([]);
      knexMock.clearSelect.mockReturnValue(knexMock);
      knexMock.clearOrder.mockReturnValue(knexMock);
      knexMock.countDistinct.mockResolvedValue([{ count: '0' }]);

      // Act
      const result = await service.findAll(queryWithExclude);

      // Assert
      expect(result.total).toBe(0);
      expect(knexMock.whereNotExists).toHaveBeenCalled();
    });

    it('should use default pagination values', async () => {
      // Arrange
      knexMock.leftJoin.mockReturnValue(knexMock);
      knexMock.whereNot.mockReturnValue(knexMock);
      knexMock.clone.mockReturnValue(knexMock);
      knexMock.select.mockReturnValue(knexMock);
      knexMock.orderBy.mockReturnValue(knexMock);
      knexMock.offset.mockReturnValue(knexMock);
      knexMock.limit.mockResolvedValue([]);
      knexMock.clearSelect.mockReturnValue(knexMock);
      knexMock.clearOrder.mockReturnValue(knexMock);
      knexMock.countDistinct.mockResolvedValue([{ count: '0' }]);

      // Act
      const result = await service.findAll({});

      // Assert
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(0);
    });
  });

  describe('findOne', () => {
    it('should return repair part by id', async () => {
      // Arrange
      knexMock.where.mockReturnValue(knexMock);
      knexMock.whereNot.mockReturnValue(knexMock);
      knexMock.first.mockResolvedValue(mockRepairPart);

      // Act
      const result = await service.findOne(mockRepairPart.id);

      // Assert
      expect(result).toEqual(mockRepairPart);
      expect(knexMock.where).toHaveBeenCalledWith({ id: mockRepairPart.id });
    });

    it('should throw NotFoundException when part not found', async () => {
      // Arrange
      knexMock.where.mockReturnValue(knexMock);
      knexMock.whereNot.mockReturnValue(knexMock);
      knexMock.first.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne('non-existent'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto = {
      part_name_uz: 'Updated Ekran',
      part_name_ru: 'Обновленный экран',
      part_name_en: 'Updated Screen',
      price: '150000',
    };

    it('should update repair part successfully', async () => {
      // Arrange
      knexMock.where.mockReturnValue(knexMock);
      knexMock.whereNot.mockReturnValue(knexMock);
      knexMock.andWhere.mockReturnValue(knexMock);
      knexMock.first.mockResolvedValueOnce(mockRepairPart) // Part exists
                   .mockResolvedValueOnce(null); // No conflict
      knexMock.update.mockReturnValue(knexMock);
      knexMock.returning.mockResolvedValue([{ ...mockRepairPart, ...updateDto }]);

      // Act
      const result = await service.update(mockRepairPart.id, updateDto);

      // Assert
      expect(result).toEqual({ message: 'Repair part updated successfully' });
      expect(knexMock.update).toHaveBeenCalledWith({
        ...updateDto,
        updated_at: expect.any(Date),
      });
    });

    it('should throw NotFoundException when part not found', async () => {
      // Arrange
      knexMock.where.mockReturnValue(knexMock);
      knexMock.whereNot.mockReturnValue(knexMock);
      knexMock.first.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update('non-existent', updateDto))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when name conflict exists', async () => {
      // Arrange
      knexMock.where.mockReturnValue(knexMock);
      knexMock.whereNot.mockReturnValue(knexMock);
      knexMock.andWhere.mockReturnValue(knexMock);
      knexMock.first.mockResolvedValueOnce(mockRepairPart) // Part exists
                   .mockResolvedValueOnce(mockRepairPart); // Conflict found

      // Act & Assert
      await expect(service.update(mockRepairPart.id, updateDto))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('delete', () => {
    it('should soft delete repair part successfully', async () => {
      // Arrange
      knexMock.where.mockReturnValue(knexMock);
      knexMock.whereNot.mockReturnValue(knexMock);
      knexMock.first.mockResolvedValue(mockRepairPart);
      knexMock.update.mockResolvedValue(1);

      // Act
      const result = await service.delete(mockRepairPart.id);

      // Assert
      expect(result).toEqual({ message: 'Repair part deleted successfully' });
      expect(knexMock.update).toHaveBeenCalledWith({
        status: 'Deleted',
        updated_at: expect.any(Date),
      });
    });

    it('should throw NotFoundException when part not found', async () => {
      // Arrange
      knexMock.where.mockReturnValue(knexMock);
      knexMock.whereNot.mockReturnValue(knexMock);
      knexMock.first.mockResolvedValue(null);

      // Act & Assert
      await expect(service.delete('non-existent'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('assignRepairPartsToProblemCategory', () => {
    const assignDto = {
      problem_category_id: 'problem-cat-1',
      repair_parts: [
        { id: 'part-1', is_required: true },
        { id: 'part-2', is_required: false },
      ],
    };

    it('should assign repair parts to problem category successfully', async () => {
      // Arrange
      knexMock.whereIn.mockReturnValue(knexMock);
      knexMock.andWhere.mockReturnValue(knexMock);
      knexMock.select.mockResolvedValue([
        { id: 'part-1' },
        { id: 'part-2' },
      ]);
      knexMock.where.mockReturnValue(knexMock);
      knexMock.delete.mockResolvedValue(1);
      knexMock.insert.mockResolvedValue([]);

      // Act
      await service.assignRepairPartsToProblemCategory(assignDto);

      // Assert
      expect(knexMock.delete).toHaveBeenCalledWith();
      expect(knexMock.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            problem_category_id: 'problem-cat-1',
            repair_part_id: 'part-1',
            is_required: true,
          }),
          expect.objectContaining({
            problem_category_id: 'problem-cat-1',
            repair_part_id: 'part-2',
            is_required: false,
          }),
        ])
      );
    });

    it('should throw BadRequestException for invalid part IDs', async () => {
      // Arrange
      knexMock.whereIn.mockReturnValue(knexMock);
      knexMock.andWhere.mockReturnValue(knexMock);
      knexMock.select.mockResolvedValue([{ id: 'part-1' }]); // Only part-1 exists

      // Act & Assert
      await expect(service.assignRepairPartsToProblemCategory(assignDto))
        .rejects.toThrow(BadRequestException);
    });

    it('should handle empty repair parts array', async () => {
      // Arrange
      const emptyAssignDto = {
        problem_category_id: 'problem-cat-1',
        repair_parts: [],
      };

      knexMock.whereIn.mockReturnValue(knexMock);
      knexMock.andWhere.mockReturnValue(knexMock);
      knexMock.select.mockResolvedValue([]);
      knexMock.where.mockReturnValue(knexMock);
      knexMock.delete.mockResolvedValue(1);

      // Act
      await service.assignRepairPartsToProblemCategory(emptyAssignDto);

      // Assert
      expect(knexMock.delete).toHaveBeenCalled();
      expect(knexMock.insert).not.toHaveBeenCalled();
    });
  });
});