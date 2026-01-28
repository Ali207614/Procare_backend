import { Test, TestingModule } from '@nestjs/testing';
import { CouriersService } from '../../src/couriers.service';
import { Knex } from 'knex';
import { getKnexToken } from 'nestjs-knex';
import { Courier } from '../../src/common/types/courier.interface';

describe('CouriersService', () => {
  let service: CouriersService;
  let knexMock: jest.Mocked<Knex>;

  const mockCouriers: Courier[] = [
    {
      id: '550e8400-e29b-41d4-a716-446655440000',
      full_name: 'John Courier',
      phone: '+998901234567',
      branches: ['branch-1', 'branch-2'],
      is_active: true,
      status: 'Open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      total: 2,
    },
    {
      id: '660e8400-e29b-41d4-a716-446655440001',
      full_name: 'Jane Courier',
      phone: '+998901234568',
      branches: ['branch-1'],
      is_active: true,
      status: 'Open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      total: 2,
    },
  ];

  beforeEach(async () => {
    knexMock = {
      raw: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouriersService,
        {
          provide: getKnexToken(),
          useValue: knexMock,
        },
      ],
    }).compile();

    service = module.get<CouriersService>(CouriersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    const query = {
      search: 'John',
      limit: 10,
      offset: 0,
      branch_id: 'branch-1',
    };

    it('should return paginated couriers with search', async () => {
      // Arrange
      knexMock.raw.mockResolvedValue({
        rows: mockCouriers,
      });

      // Act
      const result = await service.findAll(query);

      // Assert
      expect(result.rows).toEqual(
        mockCouriers.map(({ total, ...rest }) => ({
          ...rest,
          branches: rest.branches || [],
        }))
      );
      expect(result.total).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(0);
      expect(knexMock.raw).toHaveBeenCalledWith(
        expect.any(String),
        {
          search: 'John',
          limit: 10,
          offset: 0,
          branch_id: 'branch-1',
        }
      );
    });

    it('should return couriers without search filter', async () => {
      // Arrange
      const queryWithoutSearch = { ...query, search: undefined };
      knexMock.raw.mockResolvedValue({
        rows: mockCouriers,
      });

      // Act
      const result = await service.findAll(queryWithoutSearch);

      // Assert
      expect(result.rows).toHaveLength(2);
      expect(knexMock.raw).toHaveBeenCalledWith(
        expect.any(String),
        {
          search: null,
          limit: 10,
          offset: 0,
          branch_id: 'branch-1',
        }
      );
    });

    it('should use default pagination values', async () => {
      // Arrange
      const minimalQuery = { branch_id: 'branch-1' };
      knexMock.raw.mockResolvedValue({
        rows: mockCouriers,
      });

      // Act
      const result = await service.findAll(minimalQuery);

      // Assert
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
      expect(knexMock.raw).toHaveBeenCalledWith(
        expect.any(String),
        {
          search: null,
          limit: 20,
          offset: 0,
          branch_id: 'branch-1',
        }
      );
    });

    it('should handle empty results', async () => {
      // Arrange
      knexMock.raw.mockResolvedValue({
        rows: [],
      });

      // Act
      const result = await service.findAll(query);

      // Assert
      expect(result.rows).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should handle couriers with null branches', async () => {
      // Arrange
      const couriersWithNullBranches = [
        { ...mockCouriers[0], branches: null },
      ];
      knexMock.raw.mockResolvedValue({
        rows: couriersWithNullBranches,
      });

      // Act
      const result = await service.findAll(query);

      // Assert
      expect(result.rows[0].branches).toEqual([]);
    });
  });
});