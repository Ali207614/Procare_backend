import { Test, TestingModule } from '@nestjs/testing';
import { CouriersController } from '../../src/couriers.controller';
import { CouriersService } from '../../src/couriers.service';
import { Courier } from '../../src/common/types/courier.interface';
import { CourierQueryDto } from '../../src/dto/courier-query.dto';

describe('CouriersController', () => {
  let controller: CouriersController;
  let service: CouriersService;

  const mockCouriersService = {
    findAll: jest.fn(),
  };

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
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CouriersController],
      providers: [
        {
          provide: CouriersService,
          useValue: mockCouriersService,
        },
      ],
    }).compile();

    controller = module.get<CouriersController>(CouriersController);
    service = module.get<CouriersService>(CouriersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findCouriers', () => {
    it('should return paginated list of couriers', async () => {
      // Arrange
      const query: CourierQueryDto = {
        search: 'John',
        limit: 10,
        offset: 0,
        branch_id: 'branch-1',
      };

      const expectedResult = {
        rows: mockCouriers,
        total: 1,
        limit: 10,
        offset: 0,
      };

      mockCouriersService.findAll.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.findCouriers(query);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.findAll).toHaveBeenCalledWith(query);
    });

    it('should handle empty search results', async () => {
      // Arrange
      const query: CourierQueryDto = {
        search: 'nonexistent',
        limit: 10,
        offset: 0,
        branch_id: 'branch-1',
      };

      const expectedResult = {
        rows: [],
        total: 0,
        limit: 10,
        offset: 0,
      };

      mockCouriersService.findAll.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.findCouriers(query);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(result.rows).toHaveLength(0);
    });

    it('should work with minimal query parameters', async () => {
      // Arrange
      const query: CourierQueryDto = {
        branch_id: 'branch-1',
      };

      const expectedResult = {
        rows: mockCouriers,
        total: 1,
        limit: 20,
        offset: 0,
      };

      mockCouriersService.findAll.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.findCouriers(query);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.findAll).toHaveBeenCalledWith(query);
    });
  });
});