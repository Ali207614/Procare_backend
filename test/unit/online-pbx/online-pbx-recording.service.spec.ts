import axios from 'axios';
import { OnlinePbxRecordingService } from 'src/online-pbx/online-pbx-recording.service';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('OnlinePbxRecordingService', () => {
  const config = {
    get: jest.fn((key: string) => {
      switch (key) {
        case 'PBX_API_HOST':
          return 'https://api2.onlinepbx.ru';
        case 'PBX_DOMAIN':
          return 'example.onpbx.ru';
        case 'PBX_AUTH_KEY':
          return 'auth-key';
        default:
          return undefined;
      }
    }),
  };
  const logger = {
    warn: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.isAxiosError.mockReturnValue(false);
  });

  it('authenticates and returns a fresh recording URL by call uuid', async () => {
    mockedAxios.post
      .mockResolvedValueOnce({ data: { data: { key_id: 'key-id', key: 'secret-key' } } })
      .mockResolvedValueOnce({
        data: {
          status: '1',
          data: 'https://api2.onlinepbx.ru/calls-records/download/fresh/rec.mp3',
        },
      });

    const service = new OnlinePbxRecordingService(config as any, logger as any);

    await expect(service.getFreshDownloadUrl('call-uuid')).resolves.toBe(
      'https://api2.onlinepbx.ru/calls-records/download/fresh/rec.mp3',
    );
    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      1,
      'https://api2.onlinepbx.ru/example.onpbx.ru/auth.json',
      expect.any(URLSearchParams),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/x-www-form-urlencoded',
        }),
      }),
    );
    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      2,
      'https://api2.onlinepbx.ru/example.onpbx.ru/mongo_history/search.json',
      expect.any(URLSearchParams),
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-pbx-authentication': 'key-id:secret-key',
        }),
      }),
    );
  });

  it('gets a new OnlinePBX key and retries when the previous key is expired', async () => {
    mockedAxios.post
      .mockResolvedValueOnce({ data: { data: { key_id: 'old-id', key: 'old-key' } } })
      .mockResolvedValueOnce({
        data: { isNotAuth: true, message: 'KEY_IS_EXPIRED', error_code: 'KEY_IS_EXPIRED' },
      })
      .mockResolvedValueOnce({ data: { data: { key_id: 'new-id', key: 'new-key' } } })
      .mockResolvedValueOnce({
        data: {
          status: '1',
          data: 'https://api2.onlinepbx.ru/calls-records/download/new/rec.mp3',
        },
      });

    const service = new OnlinePbxRecordingService(config as any, logger as any);

    await expect(service.getFreshDownloadUrl('call-uuid')).resolves.toBe(
      'https://api2.onlinepbx.ru/calls-records/download/new/rec.mp3',
    );
    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      4,
      'https://api2.onlinepbx.ru/example.onpbx.ru/mongo_history/search.json',
      expect.any(URLSearchParams),
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-pbx-authentication': 'new-id:new-key',
        }),
      }),
    );
  });

  it('returns null instead of failing the comments endpoint when refresh fails', async () => {
    mockedAxios.post.mockRejectedValueOnce(new Error('network error'));

    const service = new OnlinePbxRecordingService(config as any, logger as any);

    await expect(service.getFreshDownloadUrl('call-uuid')).resolves.toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      '[OnlinePBX] Failed to refresh recording URL for call-uuid: network error',
    );
  });
});
