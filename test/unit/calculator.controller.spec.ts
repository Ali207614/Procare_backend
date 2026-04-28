import { CalculatorController } from '../../src/calculator/calculator.controller';
import { CalculatorService } from '../../src/calculator/calculator.service';

describe('CalculatorController', () => {
  let controller: CalculatorController;
  let service: jest.Mocked<CalculatorService>;

  beforeEach(() => {
    service = {
      getOsTypes: jest.fn(),
      getPhoneCategories: jest.fn(),
      getProblemCategories: jest.fn(),
    } as unknown as jest.Mocked<CalculatorService>;

    controller = new CalculatorController(service);
  });

  describe('getPhoneCategories', () => {
    it('should pass parent_id and search query to service', async () => {
      service.getPhoneCategories.mockResolvedValue([]);

      await controller.getPhoneCategories('os-type-id', {
        parent_id: 'parent-id',
        search: 'iPhone 15',
      });

      expect(service.getPhoneCategories).toHaveBeenCalledWith(
        'os-type-id',
        'parent-id',
        'iPhone 15',
      );
    });
  });
});
