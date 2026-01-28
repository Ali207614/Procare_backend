import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '../../src/redis.service';
import IORedis from 'ioredis';

// Mock IORedis
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  pipeline: jest.fn(),
  exec: jest.fn(),
  mget: jest.fn(),
  mset: jest.fn(),
  exists: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
  flushall: jest.fn(),
  quit: jest.fn(),
  disconnect: jest.fn(),
  status: 'ready',
};

describe('RedisService', () => {
  let service: RedisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: 'REDIS_CLIENT',
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('should get value from Redis', async () => {
      // Arrange
      const key = 'test-key';
      const value = 'test-value';
      mockRedis.get.mockResolvedValue(value);

      // Act
      const result = await service.get(key);

      // Assert
      expect(result).toBe(value);
      expect(mockRedis.get).toHaveBeenCalledWith(key);
    });

    it('should return parsed JSON for complex objects', async () => {
      // Arrange
      const key = 'test-key';
      const value = { name: 'test', id: 123 };
      mockRedis.get.mockResolvedValue(JSON.stringify(value));

      // Act
      const result = await service.get(key);

      // Assert
      expect(result).toEqual(value);
    });

    it('should return null for non-existent keys', async () => {
      // Arrange
      const key = 'non-existent-key';
      mockRedis.get.mockResolvedValue(null);

      // Act
      const result = await service.get(key);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should set string value in Redis', async () => {
      // Arrange
      const key = 'test-key';
      const value = 'test-value';
      mockRedis.set.mockResolvedValue('OK');

      // Act
      const result = await service.set(key, value);

      // Assert
      expect(result).toBe('OK');
      expect(mockRedis.set).toHaveBeenCalledWith(key, value);
    });

    it('should set value with TTL', async () => {
      // Arrange
      const key = 'test-key';
      const value = 'test-value';
      const ttl = 300;
      mockRedis.set.mockResolvedValue('OK');

      // Act
      const result = await service.set(key, value, ttl);

      // Assert
      expect(result).toBe('OK');
      expect(mockRedis.set).toHaveBeenCalledWith(key, value, 'EX', ttl);
    });

    it('should stringify complex objects', async () => {
      // Arrange
      const key = 'test-key';
      const value = { name: 'test', id: 123 };
      mockRedis.set.mockResolvedValue('OK');

      // Act
      await service.set(key, value);

      // Assert
      expect(mockRedis.set).toHaveBeenCalledWith(key, JSON.stringify(value));
    });
  });

  describe('del', () => {
    it('should delete key from Redis', async () => {
      // Arrange
      const key = 'test-key';
      mockRedis.del.mockResolvedValue(1);

      // Act
      const result = await service.del(key);

      // Assert
      expect(result).toBe(1);
      expect(mockRedis.del).toHaveBeenCalledWith(key);
    });

    it('should delete multiple keys', async () => {
      // Arrange
      const keys = ['key1', 'key2', 'key3'];
      mockRedis.del.mockResolvedValue(3);

      // Act
      const result = await service.del(keys);

      // Assert
      expect(result).toBe(3);
      expect(mockRedis.del).toHaveBeenCalledWith(keys);
    });
  });

  describe('flushByPrefix', () => {
    it('should delete all keys with given prefix', async () => {
      // Arrange
      const prefix = 'user:';
      const keys = ['user:1', 'user:2', 'user:3'];
      mockRedis.keys.mockResolvedValue(keys);
      const pipeline = {
        del: jest.fn(),
        exec: jest.fn().mockResolvedValue([]),
      };
      mockRedis.pipeline.mockReturnValue(pipeline);

      // Act
      await service.flushByPrefix(prefix);

      // Assert
      expect(mockRedis.keys).toHaveBeenCalledWith(`${prefix}*`);
      expect(mockRedis.pipeline).toHaveBeenCalled();
      expect(pipeline.del).toHaveBeenCalledTimes(3);
      expect(pipeline.exec).toHaveBeenCalled();
    });

    it('should handle empty prefix results', async () => {
      // Arrange
      const prefix = 'nonexistent:';
      mockRedis.keys.mockResolvedValue([]);

      // Act
      await service.flushByPrefix(prefix);

      // Assert
      expect(mockRedis.keys).toHaveBeenCalledWith(`${prefix}*`);
      expect(mockRedis.pipeline).not.toHaveBeenCalled();
    });
  });

  describe('exists', () => {
    it('should check if key exists', async () => {
      // Arrange
      const key = 'test-key';
      mockRedis.exists.mockResolvedValue(1);

      // Act
      const result = await service.exists(key);

      // Assert
      expect(result).toBe(true);
      expect(mockRedis.exists).toHaveBeenCalledWith(key);
    });

    it('should return false for non-existent key', async () => {
      // Arrange
      const key = 'non-existent-key';
      mockRedis.exists.mockResolvedValue(0);

      // Act
      const result = await service.exists(key);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('expire', () => {
    it('should set expiration time for key', async () => {
      // Arrange
      const key = 'test-key';
      const seconds = 300;
      mockRedis.expire.mockResolvedValue(1);

      // Act
      const result = await service.expire(key, seconds);

      // Assert
      expect(result).toBe(true);
      expect(mockRedis.expire).toHaveBeenCalledWith(key, seconds);
    });
  });

  describe('error handling', () => {
    it('should handle Redis connection errors', async () => {
      // Arrange
      const key = 'test-key';
      mockRedis.get.mockRejectedValue(new Error('Connection failed'));

      // Act & Assert
      await expect(service.get(key)).rejects.toThrow('Connection failed');
    });

    it('should handle invalid JSON parsing gracefully', async () => {
      // Arrange
      const key = 'test-key';
      const invalidJson = '{invalid json}';
      mockRedis.get.mockResolvedValue(invalidJson);

      // Act
      const result = await service.get(key);

      // Assert
      expect(result).toBe(invalidJson); // Should return as string if JSON parse fails
    });
  });
});