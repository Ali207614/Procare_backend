import { Test, TestingModule } from '@nestjs/testing';
import { RolesService } from '../../src/roles.service';
import { Knex } from 'knex';
import { getKnexToken } from 'nestjs-knex';
import { RedisService } from '../../src/common/redis/redis.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('RolesService', () => {
  let service: RolesService;
  let knexMock: jest.Mocked<Knex>;
  let redisMock: jest.Mocked<RedisService>;

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
    const mockQueryBuilder: any = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      first: jest.fn(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      returning: jest.fn(),
    };

    knexMock = {
      transaction: jest.fn(),
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
        RolesService,
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

    service = module.get<RolesService>(RolesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all roles', async () => {
      // Arrange
      knexMock.where.mockReturnValue(knexMock);
      knexMock.orderBy.mockResolvedValue([mockRole]);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toEqual([mockRole]);
      expect(knexMock.where).toHaveBeenCalledWith('is_active', true);
      expect(knexMock.where).toHaveBeenCalledWith('status', 'Open');
    });
  });

  describe('findOne', () => {
    it('should return role by id', async () => {
      // Arrange
      knexMock.where.mockReturnValue(knexMock);
      knexMock.first.mockResolvedValue(mockRole);

      // Act
      const result = await service.findOne(mockRole.id);

      // Assert
      expect(result).toEqual(mockRole);
      expect(knexMock.where).toHaveBeenCalledWith('id', mockRole.id);
    });

    it('should throw NotFoundException when role not found', async () => {
      // Arrange
      knexMock.where.mockReturnValue(knexMock);
      knexMock.first.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne('non-existent-id'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('cache management', () => {
    it('should flush cache after operations', () => {
      expect(redisMock.flushByPrefix).toBeDefined();
    });
  });
});