import { RepairOrderCreateHelperService } from 'src/repair-orders/services/repair-order-create-helper.service';

describe('RepairOrderCreateHelperService', () => {
  function createService(raw = jest.fn()) {
    const knex = { raw };

    return {
      service: new RepairOrderCreateHelperService(
        knex as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
      ),
      knex,
    };
  }

  describe('getRepairOrdersNotificationMeta', () => {
    it('binds repair order IDs as a uuid array', async () => {
      const raw = jest.fn().mockResolvedValue({ rows: [{ order_id: 'order-1' }] });
      const { service } = createService(raw);
      const orderIds = ['15d1940a-a066-4ea5-89f4-39ab82cdd1e3'];

      const result = await service.getRepairOrdersNotificationMeta(orderIds);

      expect(result).toEqual([{ order_id: 'order-1' }]);
      expect(raw).toHaveBeenCalledTimes(1);
      expect(raw.mock.calls[0][0]).toContain('WHERE ro.id = ANY(?::uuid[])');
      expect(raw.mock.calls[0][1]).toEqual([orderIds]);
    });

    it('does not query when there are no repair order IDs', async () => {
      const raw = jest.fn();
      const { service } = createService(raw);

      await expect(service.getRepairOrdersNotificationMeta([])).resolves.toEqual([]);
      expect(raw).not.toHaveBeenCalled();
    });
  });
});
