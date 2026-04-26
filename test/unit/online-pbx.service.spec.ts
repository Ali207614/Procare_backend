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
    assignTelephonyAdminToExistingOrder: jest.Mock;
    incrementCallCount: jest.Mock;
    handleCallAnswered: jest.Mock;
    incrementMissedCallCount: jest.Mock;
    recordCustomerNoAnswer: jest.Mock;
    moveToTopById: jest.Mock;
    notifyAvailableAssignedAdminsForIncomingCall: jest.Mock;
  };
  let historyService: {
    createEvent: jest.Mock;
  };
  let insertChain: {
    onConflict: jest.Mock;
  };
  let mergeSpy: jest.Mock;
  let commentInsertSpy: jest.Mock;
  let firstAdminSpy: jest.Mock;
  let adminWhereSpy: jest.Mock;
  let phoneCallsWhereSpy: jest.Mock;
  let phoneCallFirstSpy: jest.Mock;
  let repairOrdersWhereSpy: jest.Mock;
  let repairOrderFirstSpy: jest.Mock;

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
    commentInsertSpy = jest.fn().mockResolvedValue(undefined);
    phoneCallFirstSpy = jest.fn().mockResolvedValue(undefined);
    phoneCallsWhereSpy = jest.fn().mockReturnValue({
      first: phoneCallFirstSpy,
    });
    repairOrderFirstSpy = jest.fn().mockResolvedValue(undefined);
    repairOrdersWhereSpy = jest.fn().mockReturnValue({
      first: repairOrderFirstSpy,
    });
    firstAdminSpy = jest.fn().mockResolvedValue({ id: 'admin-1' });
    adminWhereSpy = jest.fn().mockReturnValue({
      first: jest.fn().mockResolvedValue(undefined),
    });
    insertChain = {
      onConflict: jest.fn().mockReturnValue({
        merge: mergeSpy,
      }),
    };

    knex = jest.fn((table: string) => {
      if (table === 'phone_calls') {
        return {
          where: phoneCallsWhereSpy,
          first: phoneCallFirstSpy,
          insert: jest.fn().mockReturnValue(insertChain),
        };
      }

      if (table === 'repair_order_comments') {
        return {
          insert: commentInsertSpy,
        };
      }

      if (table === 'repair_orders') {
        return {
          where: repairOrdersWhereSpy,
        };
      }

      if (table === 'admins') {
        return {
          where: adminWhereSpy,
          orderBy: jest.fn().mockReturnValue({
            first: firstAdminSpy,
          }),
        };
      }

      if (table === 'users') {
        return {
          where: jest.fn().mockReturnValue({
            first: jest.fn().mockResolvedValue(undefined),
          }),
        };
      }

      return {
        where: jest.fn().mockReturnValue({
          first: jest.fn().mockResolvedValue(undefined),
        }),
        first: jest.fn().mockResolvedValue(undefined),
        insert: jest.fn().mockReturnValue(insertChain),
      };
    }) as unknown as jest.Mock;
    (knex as any).transaction = jest.fn(async (callback: (trx: any) => Promise<unknown>) =>
      callback(knex as any),
    );

    repairOrderService = {
      findOpenOrderByPhoneNumber: jest.fn(),
      createFromWebhook: jest.fn(),
      assignTelephonyAdminToExistingOrder: jest.fn(),
      incrementCallCount: jest.fn(),
      handleCallAnswered: jest.fn(),
      incrementMissedCallCount: jest.fn(),
      recordCustomerNoAnswer: jest.fn(),
      moveToTopById: jest.fn(),
      notifyAvailableAssignedAdminsForIncomingCall: jest.fn(),
    };
    historyService = {
      createEvent: jest.fn().mockResolvedValue({ id: 'history-event-1' }),
    };

    service = new OnlinePbxService(
      logger as any,
      config as any,
      knex as any,
      repairOrderService as any,
      historyService as any,
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
    expect(historyService.createEvent).not.toHaveBeenCalled();
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
      expect(historyService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          actionKey: 'online_pbx.webhook.unknown',
          actionKind: 'webhook',
          sourceType: 'webhook',
          sourceName: 'online-pbx',
          correlationId: `call-${gateway}`,
        }),
        knex,
      );
    },
  );

  it('notifies available assigned admins on inbound call_start for an existing open order', async () => {
    repairOrderService.findOpenOrderByPhoneNumber.mockResolvedValue({
      id: 'order-1',
    });

    await service.handleWebhook({
      uuid: 'call-start-1',
      gateway: '+998781133774',
      direction: 'inbound',
      event: 'call_start',
      caller: '+998901234567',
      callee: '120',
    });

    expect(repairOrderService.incrementCallCount).toHaveBeenCalledWith('order-1');
    expect(repairOrderService.notifyAvailableAssignedAdminsForIncomingCall).toHaveBeenCalledWith(
      'order-1',
    );
  });

  it('creates a repair order on inbound call_start when no open order exists', async () => {
    repairOrderService.findOpenOrderByPhoneNumber.mockResolvedValue(undefined);
    repairOrderService.createFromWebhook.mockResolvedValue({
      id: 'order-2',
      user_id: null,
    });

    await service.handleWebhook({
      uuid: 'call-start-new-1',
      gateway: '+998781133774',
      direction: 'inbound',
      event: 'call_start',
      caller: '+998901234567',
      callee: '120',
    });

    expect(repairOrderService.createFromWebhook).toHaveBeenCalledWith({
      userId: null,
      branchId: '00000000-0000-4000-8000-000000000000',
      statusId: '50000000-0000-0000-0001-001000000000',
      phoneNumber: '+998901234567',
      source: 'Kiruvchi qongiroq',
      onlinepbxCode: '120',
      fallbackToFewestOpen: false,
    });
    expect(logger.log).toHaveBeenCalledWith(
      '[OnlinePBX Webhook] Saving phone call call-start-new-1 with user_id: null and repair_order_id: order-2',
    );
  });

  it('assigns the calling admin on outbound call_start for an existing open order', async () => {
    repairOrderService.findOpenOrderByPhoneNumber.mockResolvedValue({
      id: 'order-1',
    });

    await service.handleWebhook({
      uuid: 'call-start-outbound-1',
      gateway: '+998781133774',
      direction: 'outbound',
      event: 'call_start',
      caller: '120',
      callee: '+998901234567',
    });

    expect(repairOrderService.assignTelephonyAdminToExistingOrder).toHaveBeenCalledWith({
      branchId: '00000000-0000-4000-8000-000000000000',
      orderId: 'order-1',
      onlinepbxCode: '120',
    });
    expect(repairOrderService.incrementCallCount).toHaveBeenCalledWith('order-1');
  });

  it('creates a repair order comment on inbound call_end when dialog_duration is greater than zero', async () => {
    repairOrderService.findOpenOrderByPhoneNumber.mockResolvedValue({
      id: 'order-1',
    });
    repairOrderFirstSpy.mockResolvedValue({ status_id: 'status-1' });

    await service.handleWebhook({
      uuid: 'call-end-inbound-1',
      gateway: '+998781133774',
      direction: 'inbound',
      event: 'call_end',
      caller: '+998901234567',
      callee: '120',
      dialog_duration: 125,
    });

    expect(repairOrderService.moveToTopById).toHaveBeenCalledWith('order-1');
    expect(commentInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        repair_order_id: 'order-1',
        status_by: 'status-1',
        created_by: 'admin-1',
        text: "Mijoz bilan kiruvchi qo'ng'iroq bo'lib o'tdi (2 daqiqa 5 soniya)",
      }),
    );
  });

  it('does not create a repair order comment when dialog_duration is zero', async () => {
    repairOrderService.findOpenOrderByPhoneNumber.mockResolvedValue({
      id: 'order-1',
    });

    await service.handleWebhook({
      uuid: 'call-end-inbound-2',
      gateway: '+998781133774',
      direction: 'inbound',
      event: 'call_end',
      caller: '+998901234567',
      callee: '120',
      dialog_duration: 0,
    });

    expect(commentInsertSpy).not.toHaveBeenCalled();
  });

  it('creates a repair order comment for missed inbound calls', async () => {
    repairOrderService.findOpenOrderByPhoneNumber.mockResolvedValue({
      id: 'order-1',
    });
    repairOrderFirstSpy.mockResolvedValue({ status_id: 'status-1' });

    await service.handleWebhook({
      uuid: 'call-missed-inbound-1',
      gateway: '+998781133774',
      direction: 'inbound',
      event: 'call_missed',
      caller: '+998901234567',
      callee: '120',
    });

    expect(repairOrderService.incrementMissedCallCount).toHaveBeenCalledWith('order-1');
    expect(commentInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        repair_order_id: 'order-1',
        status_by: 'status-1',
        created_by: 'admin-1',
        text: "Kiruvchi qo'ng'iroq o'tkazib yuborildi",
      }),
    );
  });

  it('records customer no-answer on outbound call_end when dialog_duration is zero', async () => {
    repairOrderService.findOpenOrderByPhoneNumber.mockResolvedValue({
      id: 'order-1',
    });

    await service.handleWebhook({
      uuid: 'call-end-outbound-no-answer-1',
      gateway: '+998781133774',
      direction: 'outbound',
      event: 'call_end',
      caller: '120',
      callee: '+998901234567',
      dialog_duration: 0,
      date: '1775549295',
    });

    expect(repairOrderService.recordCustomerNoAnswer).toHaveBeenCalledWith(
      'order-1',
      new Date(1775549295 * 1000),
    );
    expect(repairOrderService.moveToTopById).not.toHaveBeenCalled();
    expect(commentInsertSpy).not.toHaveBeenCalled();
  });

  it('does not count duplicate outbound no-answer call_end webhooks for the same call', async () => {
    phoneCallFirstSpy.mockResolvedValue({
      uuid: 'call-end-outbound-no-answer-duplicate',
      event: 'call_end',
      dialog_duration: null,
      repair_order_id: 'order-1',
    });
    repairOrderService.findOpenOrderByPhoneNumber.mockResolvedValue({
      id: 'order-1',
    });

    await service.handleWebhook({
      uuid: 'call-end-outbound-no-answer-duplicate',
      gateway: '+998781133774',
      direction: 'outbound',
      event: 'call_end',
      caller: '120',
      callee: '+998901234567',
      dialog_duration: 0,
    });

    expect(repairOrderService.recordCustomerNoAnswer).not.toHaveBeenCalled();
  });
});
