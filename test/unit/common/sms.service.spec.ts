import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { SmsService } from 'src/common/services/sms.service';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('SmsService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  function createService(config: Record<string, string>): SmsService {
    const configService = {
      get: jest.fn((key: string) => config[key]),
    } as unknown as ConfigService;

    return new SmsService(configService);
  }

  it('skips provider calls in development mode', async () => {
    const service = createService({
      NODE_ENV: 'development',
      SMS_API_URL: 'https://send.smsxabar.uz/broker-api/send',
      SMS_USERNAME: 'user',
      SMS_PASSWORD: 'pass',
      SMS_ORIGINATOR: 'PROBOX',
    });

    const result = await service.sendOtpSms('+998901234567', '123456', 'en');

    expect(result.success).toBe(true);
    expect(result.messageId).toMatch(/^[a-z]{3}\d{9}$/);
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('sends OTP messages with the broker payload shape', async () => {
    mockedAxios.post.mockResolvedValue({ status: 200, data: { ok: true } });

    const service = createService({
      NODE_ENV: 'production',
      SMS_API_URL: 'https://send.smsxabar.uz/broker-api/send',
      SMS_USERNAME: 'user',
      SMS_PASSWORD: 'pass',
      SMS_ORIGINATOR: 'PROBOX',
    });

    const result = await service.sendOtpSms('+998901234567', '123456', 'en');

    expect(result.success).toBe(true);
    expect(result.messageId).toMatch(/^[a-z]{3}\d{9}$/);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://send.smsxabar.uz/broker-api/send',
      {
        messages: {
          recipient: '998901234567',
          'message-id': expect.stringMatching(/^[a-z]{3}\d{9}$/),
          sms: {
            originator: 'PROBOX',
            content: {
              text: expect.stringContaining('123456'),
            },
          },
        },
      },
      {
        auth: {
          username: 'user',
          password: 'pass',
        },
        timeout: 10000,
      },
    );
  });
});
