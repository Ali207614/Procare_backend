import { OnlinePbxService } from '../../src/online-pbx/online-pbx.service';

describe('OnlinePbxService gateway filtering', () => {
  let service: OnlinePbxService;
  let logger: {
    log: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
  };
  let config: {
    get: jest.Mock;
  };
  let knex: jest.Mock;
  let repairOrderService: {
    findOpenOrderByPhoneNumber: jest.Mock;
    createFromWebhook: jest.Mock;
    incrementCallCount: jest.Mock;
    handleCallAnswered: jest.Mock;
    incrementMissedCallCount: jest.Mock;
    moveToTopById: jest.Mock;
  };
  let insertChain: {
    onConflict: jest.Mock;
  };
  let mergeSpy: jest.Mock;

  beforeEach(() => {
    logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    config = {
      get: jest.fn((key: string) => {
        switch (key) {
          case 'ONLINEPBX_API_URL':
            return 'https://api.onlinepbx.ru/v1';
          case 'ONLINEPBX_API_KEY':
            return '';
          case 'ONLINEPBX_API_SECRET':
            return '';
          case 'GATEWAY':
            return '781133774';
          default:
            return undefined;
        }
      }),
    };

    mergeSpy = jest.fn().mockResolvedValue(undefined);
    insertChain = {
      onConflict: jest.fn().mockReturnValue({
        merge: mergeSpy,
      }),
    };

    knex = jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(undefined),
      insert: jest.fn().mockReturnValue(insertChain),
    }) as unknown as jest.Mock;

    repairOrderService = {
      findOpenOrderByPhoneNumber: jest.fn(),
      createFromWebhook: jest.fn(),
      incrementCallCount: jest.fn(),
      handleCallAnswered: jest.fn(),
      incrementMissedCallCount: jest.fn(),
      moveToTopById: jest.fn(),
    };

    service = new OnlinePbxService(
      logger as any,
      config as any,
      knex as any,
      repairOrderService as any,
    );
  });

  it('ignores payloads for other gateways without touching persistence', async () => {
    await service.handleWebhook({
      uuid: 'call-1',
      gateway: '123456789',
    });

    expect(logger.log).toHaveBeenCalledWith(
      '[OnlinePBX Webhook] Ignoring payload for gateway 123456789. Not related to this project.',
    );
    expect(knex).not.toHaveBeenCalled();
    expect(repairOrderService.findOpenOrderByPhoneNumber).not.toHaveBeenCalled();
  });

  it.each(['781133774', '998781133774', '+998781133774'])(
    'accepts gateway format %s',
    async (gateway) => {
      await service.handleWebhook({
        uuid: `call-${gateway}`,
        gateway,
      });

      expect(logger.log).not.toHaveBeenCalledWith(
        `[OnlinePBX Webhook] Ignoring payload for gateway ${gateway}. Not related to this project.`,
      );
      expect(knex).toHaveBeenCalledWith('phone_calls');
      expect(insertChain.onConflict).toHaveBeenCalledWith('uuid');
      expect(mergeSpy).toHaveBeenCalled();
    },
  );
});
