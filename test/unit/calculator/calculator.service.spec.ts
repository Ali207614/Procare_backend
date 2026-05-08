import { CalculatorService } from 'src/calculator/calculator.service';

describe('CalculatorService', () => {
  describe('getProblemCategories', () => {
    it('should fetch only active root problems mapped to the phone category', async () => {
      const queryBuilder: {
        join: jest.Mock;
        where: jest.Mock;
        select: jest.Mock;
      } = {
        join: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue([
          {
            id: 'problem-id',
          },
        ]),
      };
      const knex = Object.assign(jest.fn(() => queryBuilder), {
        raw: jest.fn().mockResolvedValue({ rows: [] }),
      });
      const service = new CalculatorService(knex as never);

      await service.getProblemCategories('phone-category-id');

      expect(queryBuilder.where).toHaveBeenCalledWith({
        'ppm.phone_category_id': 'phone-category-id',
        'p.parent_id': null,
        'p.status': 'Open',
        'p.is_active': true,
        'pc.status': 'Open',
        'pc.is_active': true,
      });
      expect(knex.raw).toHaveBeenCalledWith(expect.not.stringContaining('WITH RECURSIVE'), [
        'problem-id',
      ]);
    });
  });

  describe('getPhoneCategories', () => {
    it('should apply a trimmed case-insensitive search across localized category names', async () => {
      const searchBuilder = {
        whereRaw: jest.fn().mockReturnThis(),
        orWhereRaw: jest.fn().mockReturnThis(),
      };
      const queryBuilder: {
        where: jest.Mock;
        select: jest.Mock;
        orderBy: jest.Mock;
        join: jest.Mock;
        andWhere: jest.Mock;
        then: jest.Mock;
      } = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        join: jest.fn().mockReturnThis(),
        andWhere: jest.fn((callback: (builder: typeof searchBuilder) => void) => {
          callback(searchBuilder);
          return queryBuilder;
        }),
        then: jest.fn((resolve: (rows: unknown[]) => void) => resolve([])),
      };
      const knex = Object.assign(
        jest.fn(() => queryBuilder),
        {
          raw: jest.fn((sql: string) => sql),
        },
      );
      const service = new CalculatorService(knex as never);

      await service.getPhoneCategories('os-type-id', undefined, '  IPHONE 15  ');

      expect(queryBuilder.andWhere).toHaveBeenCalledTimes(1);
      expect(searchBuilder.whereRaw).toHaveBeenCalledWith('LOWER(pc.name_uz) ILIKE ?', [
        '%iphone 15%',
      ]);
      expect(searchBuilder.orWhereRaw).toHaveBeenCalledWith('LOWER(pc.name_ru) ILIKE ?', [
        '%iphone 15%',
      ]);
      expect(searchBuilder.orWhereRaw).toHaveBeenCalledWith('LOWER(pc.name_en) ILIKE ?', [
        '%iphone 15%',
      ]);
    });

    it('should not apply search filtering when search is blank', async () => {
      const queryBuilder: {
        where: jest.Mock;
        select: jest.Mock;
        orderBy: jest.Mock;
        join: jest.Mock;
        andWhere: jest.Mock;
        then: jest.Mock;
      } = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        join: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        then: jest.fn((resolve: (rows: unknown[]) => void) => resolve([])),
      };
      const knex = Object.assign(
        jest.fn(() => queryBuilder),
        {
          raw: jest.fn((sql: string) => sql),
        },
      );
      const service = new CalculatorService(knex as never);

      await service.getPhoneCategories('os-type-id', undefined, '   ');

      expect(queryBuilder.andWhere).not.toHaveBeenCalled();
    });
  });
});
