import { CommentReaderService } from 'src/repair-orders/services/comment-reader.service';

function resolvedQuery<T>(data: T): any {
  return {
    leftJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    orderByRaw: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    count: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    whereNotNull: jest.fn().mockReturnThis(),
    then: (resolve: (value: T) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(data).then(resolve, reject),
  };
}

function createKnexMock(audioExpiresAt: string | null, audioUpdatedAt: string) {
  const commentRows = [
    {
      id: 'comment-1',
      text: 'Talk happened',
      status: 'Open',
      comment_type: 'manual',
      history_change_id: null,
      created_at: '2026-04-30T08:00:00.000Z',
      updated_at: '2026-04-30T08:00:00.000Z',
      admin_id: 'admin-1',
      admin_first_name: 'Ali',
      admin_last_name: 'Valiyev',
      admin_phone_number: '+998901234567',
      status_id: 'status-1',
      status_name_uz: 'Yangi',
      status_name_ru: 'Новый',
      status_name_en: 'New',
      status_can_user_view: true,
    },
  ];
  const audioFiles = [
    {
      id: 'phone-call-1',
      uuid: 'call-uuid',
      direction: 'inbound',
      event: 'call_end',
      caller: '+998901234567',
      callee: '120',
      call_duration: 132,
      dialog_duration: 120,
      download_url: 'https://api2.onlinepbx.ru/calls-records/download/old/rec.mp3',
      download_url_expires_at: audioExpiresAt,
      created_at: '2026-04-30T08:00:00.000Z',
      updated_at: audioUpdatedAt,
    },
  ];
  const updateSpy = jest.fn().mockResolvedValue(1);
  const rowsQuery = resolvedQuery(commentRows);
  const countQuery = resolvedQuery([{ total: '1' }]);
  const audioQuery = {
    ...resolvedQuery(audioFiles),
    update: updateSpy,
  };
  const commentBaseQuery: any = {
    where: jest.fn().mockReturnThis(),
    modify: jest.fn((callback: (qb: any) => void) => {
      callback({ whereIn: jest.fn() });
      return commentBaseQuery;
    }),
    clone: jest.fn().mockReturnValueOnce(rowsQuery).mockReturnValueOnce(countQuery),
  };
  const orderQuery = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue({ branch_id: 'branch-1', status_id: 'status-1' }),
  };

  const knex = jest.fn((table: string) => {
    if (table === 'repair_orders') return orderQuery;
    if (table === 'repair_order_comments as c') return commentBaseQuery;
    if (table === 'phone_calls') return audioQuery;
    throw new Error(`Unexpected table ${table}`);
  });

  return { knex, updateSpy };
}

describe('CommentReaderService', () => {
  it('reuses the cached OnlinePBX recording URL while it is still valid', async () => {
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const oldUpdatedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { knex, updateSpy } = createKnexMock(expiresAt, oldUpdatedAt);
    const permissionService = {
      findByRolesAndBranch: jest.fn().mockResolvedValue([]),
      checkPermissionsOrThrow: jest.fn().mockResolvedValue(undefined),
    };
    const onlinePbxRecordingService = {
      getFreshDownloadUrl: jest.fn(),
    };
    const service = new CommentReaderService(
      knex as any,
      permissionService as any,
      onlinePbxRecordingService as any,
    );

    const result = await service.findByRepairOrder({ id: 'admin-1', roles: [] } as any, 'order-1', {
      limit: 20,
      offset: 0,
    } as any);

    expect(onlinePbxRecordingService.getFreshDownloadUrl).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
    expect(result.audio_files[0]).toEqual(
      expect.not.objectContaining({
        updated_at: expect.anything(),
      }),
    );
    expect(result.audio_files[0].download_url).toBe(
      'https://api2.onlinepbx.ru/calls-records/download/old/rec.mp3',
    );
    expect(result.timezone).toBe('Asia/Tashkent');
    expect(result.comments[0]).toEqual(
      expect.objectContaining({
        created_at_local: '2026-04-30 13:00:00',
        updated_at_local: '2026-04-30 13:00:00',
      }),
    );
  });

  it('refreshes and stores a new OnlinePBX recording URL after the cached URL expires', async () => {
    const expiredAt = new Date(Date.now() - 60 * 1000).toISOString();
    const { knex, updateSpy } = createKnexMock(expiredAt, new Date().toISOString());
    const permissionService = {
      findByRolesAndBranch: jest.fn().mockResolvedValue([]),
      checkPermissionsOrThrow: jest.fn().mockResolvedValue(undefined),
    };
    const onlinePbxRecordingService = {
      getFreshDownloadUrl: jest
        .fn()
        .mockResolvedValue('https://api2.onlinepbx.ru/calls-records/download/fresh/rec.mp3'),
    };
    const service = new CommentReaderService(
      knex as any,
      permissionService as any,
      onlinePbxRecordingService as any,
    );

    const result = await service.findByRepairOrder({ id: 'admin-1', roles: [] } as any, 'order-1', {
      limit: 20,
      offset: 0,
    } as any);

    expect(onlinePbxRecordingService.getFreshDownloadUrl).toHaveBeenCalledWith('call-uuid');
    expect(updateSpy).toHaveBeenCalledWith({
      download_url: 'https://api2.onlinepbx.ru/calls-records/download/fresh/rec.mp3',
      download_url_expires_at: expect.any(String),
      updated_at: expect.any(String),
    });
    expect(result.audio_files[0].download_url).toBe(
      'https://api2.onlinepbx.ru/calls-records/download/fresh/rec.mp3',
    );
  });

  it('deduplicates simultaneous refreshes for the same phone call', async () => {
    const { knex } = createKnexMock(null, new Date().toISOString());
    const permissionService = {
      findByRolesAndBranch: jest.fn().mockResolvedValue([]),
      checkPermissionsOrThrow: jest.fn().mockResolvedValue(undefined),
    };
    let resolveFreshUrl: (url: string) => void = () => undefined;
    const onlinePbxRecordingService = {
      getFreshDownloadUrl: jest.fn(
        () =>
          new Promise<string>((resolve) => {
            resolveFreshUrl = resolve;
          }),
      ),
    };
    const service = new CommentReaderService(
      knex as any,
      permissionService as any,
      onlinePbxRecordingService as any,
    );
    const firstPromise = (service as any).getOrCreateRefreshPromise('phone-call-1', 'call-uuid');
    const secondPromise = (service as any).getOrCreateRefreshPromise('phone-call-1', 'call-uuid');

    await Promise.resolve();
    resolveFreshUrl('https://api2.onlinepbx.ru/calls-records/download/fresh/rec.mp3');

    await expect(Promise.all([firstPromise, secondPromise])).resolves.toEqual([
      'https://api2.onlinepbx.ru/calls-records/download/fresh/rec.mp3',
      'https://api2.onlinepbx.ru/calls-records/download/fresh/rec.mp3',
    ]);
    expect(onlinePbxRecordingService.getFreshDownloadUrl).toHaveBeenCalledTimes(1);
  });
});
