import { Test, TestingModule } from '@nestjs/testing';
import { CampaignsService } from '../../src/campaigns/campaigns.service';
import { Knex } from 'knex';
import { getKnexToken } from 'nestjs-knex';
import { RedisService } from '../../src/common/redis/redis.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('CampaignsService', () => {
  let service: CampaignsService;
  let knexMock: jest.Mocked<Knex>;
  let redisMock: jest.Mocked<RedisService>;

  const mockCampaign = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test Campaign',
    description: 'Test Campaign Description',
    message_template: 'Hello {name}!',
    type: 'sms',
    status: 'Draft',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(async () => {
    const mockQueryBuilder: any = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
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
        CampaignsService,
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

    service = module.get<CampaignsService>(CampaignsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      name: 'New Campaign',
      description: 'New Campaign Description',
      message_template: 'Hello {name}!',
      type: 'sms' as const,
    };

    it('should create a new campaign successfully', async () => {
      // Arrange
      const trxMock = knexMock.transaction() as any;
      trxMock.insert.mockReturnValue(trxMock);
      trxMock.returning.mockResolvedValue([mockCampaign]);

      // Act
      const result = await service.create(createDto, 'admin-id');

      // Assert
      expect(result).toEqual(mockCampaign);
      expect(trxMock.insert).toHaveBeenCalled();
      expect(redisMock.flushByPrefix).toHaveBeenCalledWith('campaigns');
    });
  });

  describe('findAll', () => {
    it('should return paginated campaigns', async () => {
      // Arrange
      knexMock.select.mockReturnValue(knexMock);
      knexMock.orderBy.mockReturnValue(knexMock);
      knexMock.limit.mockReturnValue(knexMock);
      knexMock.offset.mockResolvedValue([mockCampaign]);

      // Act
      const result = await service.findAll({ limit: 10, offset: 0 });

      // Assert
      expect(result.data).toEqual([mockCampaign]);
    });
  });

  describe('findOne', () => {
    it('should return campaign by id', async () => {
      // Arrange
      knexMock.where.mockReturnValue(knexMock);
      knexMock.first.mockResolvedValue(mockCampaign);

      // Act
      const result = await service.findOne(mockCampaign.id);

      // Assert
      expect(result).toEqual(mockCampaign);
    });

    it('should throw NotFoundException when campaign not found', async () => {
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
      name: 'Updated Campaign',
    };

    it('should update campaign successfully', async () => {
      // Arrange
      const trxMock = knexMock.transaction() as any;
      trxMock.where.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValue(mockCampaign);
      trxMock.update.mockReturnValue(trxMock);
      trxMock.returning.mockResolvedValue([{ ...mockCampaign, ...updateDto }]);

      // Act
      const result = await service.update(mockCampaign.id, updateDto, 'admin-id');

      // Assert
      expect(result.message).toContain('successfully');
    });
  });

  describe('remove', () => {
    it('should soft delete campaign successfully', async () => {
      // Arrange
      const trxMock = knexMock.transaction() as any;
      trxMock.where.mockReturnValue(trxMock);
      trxMock.first.mockResolvedValue(mockCampaign);
      trxMock.update.mockResolvedValue(1);

      // Act
      const result = await service.remove(mockCampaign.id, 'admin-id');

      // Assert
      expect(result.message).toContain('successfully');
    });
  });
});