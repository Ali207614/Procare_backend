import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { TelegramService } from 'src/telegram/telegram.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('TelegramService', () => {
  let service: TelegramService;

  const createService = async (token?: string) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(token),
          },
        },
      ],
    }).compile();

    service = module.get<TelegramService>(TelegramService);
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    it('should be enabled when token is provided', async () => {
      await createService('valid_token');
      expect(service).toBeDefined();
      expect((service as any).isEnabled).toBe(true);
      expect((service as any).baseUrl).toBe('https://api.telegram.org/botvalid_token');
    });

    it('should be disabled when token is missing', async () => {
      await createService(undefined);
      expect(service).toBeDefined();
      expect((service as any).isEnabled).toBe(false);
      expect((service as any).baseUrl).toBe('');
    });
  });

  describe('sendMessage', () => {
    it('should send message successfully', async () => {
      await createService('valid_token');
      const mockResponse = { data: { ok: true }, status: 200 };
      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await service.sendMessage(123456, 'Hello World');

      expect(result).toEqual(mockResponse);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.telegram.org/botvalid_token/sendMessage',
        {
          chat_id: 123456,
          text: 'Hello World',
          parse_mode: 'HTML',
        },
      );
    });

    it('should return null when disabled', async () => {
      await createService(undefined);
      const result = await service.sendMessage(123456, 'Hello World');
      expect(result).toBeNull();
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should handle FloodWait (429) and retry', async () => {
      jest.useFakeTimers();
      await createService('valid_token');

      const retryAfter = 2;
      const error429 = {
        isAxiosError: true,
        response: {
          status: 429,
          data: {
            parameters: {
              retry_after: retryAfter,
            },
          },
        },
      };

      const successResponse = { data: { ok: true }, status: 200 };

      mockedAxios.post
        .mockRejectedValueOnce(error429)
        .mockResolvedValueOnce(successResponse);

      mockedAxios.isAxiosError.mockReturnValue(true);

      const sendMessagePromise = service.sendMessage(123456, 'Retry Message');

      // First call happens immediately
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);

      // Wait for the timeout
      await jest.advanceTimersByTimeAsync(retryAfter * 1000);

      const result = await sendMessagePromise;

      expect(result).toEqual(successResponse);
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it('should handle generic errors and return null', async () => {
      await createService('valid_token');
      mockedAxios.post.mockRejectedValueOnce(new Error('Network error'));
      mockedAxios.isAxiosError.mockReturnValue(false);

      const result = await service.sendMessage(123456, 'Error Message');

      expect(result).toBeNull();
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendPhoto', () => {
    it('should send photo successfully', async () => {
      await createService('valid_token');
      const mockResponse = { data: { ok: true }, status: 200 };
      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await service.sendPhoto(123456, 'http://image.url', 'Caption');

      expect(result).toEqual(mockResponse);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.telegram.org/botvalid_token/sendPhoto',
        {
          chat_id: 123456,
          photo: 'http://image.url',
          caption: 'Caption',
          parse_mode: 'HTML',
        },
      );
    });

    it('should return null when disabled', async () => {
      await createService(undefined);
      const result = await service.sendPhoto(123456, 'http://image.url');
      expect(result).toBeNull();
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should handle errors and return null', async () => {
      await createService('valid_token');
      mockedAxios.post.mockRejectedValueOnce(new Error('Photo error'));

      const result = await service.sendPhoto(123456, 'http://image.url');

      expect(result).toBeNull();
    });
  });

  describe('sendDocument', () => {
    it('should send document successfully', async () => {
      await createService('valid_token');
      const mockResponse = { data: { ok: true }, status: 200 };
      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await service.sendDocument(123456, 'http://file.url', 'Doc Caption');

      expect(result).toEqual(mockResponse);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.telegram.org/botvalid_token/sendDocument',
        {
          chat_id: 123456,
          document: 'http://file.url',
          caption: 'Doc Caption',
          parse_mode: 'HTML',
        },
      );
    });

    it('should return null when disabled', async () => {
      await createService(undefined);
      const result = await service.sendDocument(123456, 'http://file.url');
      expect(result).toBeNull();
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should handle errors and return null', async () => {
      await createService('valid_token');
      mockedAxios.post.mockRejectedValueOnce(new Error('Doc error'));

      const result = await service.sendDocument(123456, 'http://file.url');

      expect(result).toBeNull();
    });
  });
});
