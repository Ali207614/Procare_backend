import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  private readonly prefix = process.env.REDIS_PREFIX || 'procare';
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject('REDIS_CLIENT') private readonly client: Redis) {}

  private buildKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  private async ensureConnected(): Promise<boolean> {
    if (this.client.status !== 'ready') {
      try {
        await this.client.connect();
      } catch (err) {
        this.logger.warn('⚠️ Redis not connected, skipping operation');
        return false;
      }
    }
    return true;
  }

  async set(key: string, value: unknown, ttlSeconds = 3600): Promise<void> {
    if (!(await this.ensureConnected())) return;

    try {
      await this.client.set(this.buildKey(key), JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      this.handleError(error, `Redis SET error for key=${key}`);
    }
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    if (!(await this.ensureConnected())) return null;

    try {
      const data = await this.client.get(this.buildKey(key));
      return typeof data === 'string' ? (JSON.parse(data) as T) : null;
    } catch (error) {
      this.handleError(error, `Redis GET error for key=${key}`);
      return null;
    }
  }

  async del(key: string): Promise<void> {
    if (!(await this.ensureConnected())) return;

    try {
      await this.client.del(this.buildKey(key));
    } catch (error) {
      this.handleError(error, `Redis DEL error for key=${key}`);
    }
  }

  async flushByPrefix(pattern: string): Promise<void> {
    if (!(await this.ensureConnected())) return;

    try {
      const fullPattern = this.buildKey(`${pattern}*`);
      const keys = await this.client.keys(fullPattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (error) {
      this.handleError(error, `Redis FLUSH error for pattern=${pattern}`);
    }
  }

  async mget<T = unknown>(...keys: string[]): Promise<(T | null)[]> {
    if (!(await this.ensureConnected())) return keys.map(() => null);

    try {
      const redisKeys = keys.map((k) => this.buildKey(k));
      const results = await this.client.mget(...redisKeys);
      return results.map((item) => (item ? (JSON.parse(item) as T) : null));
    } catch (error) {
      this.handleError(error, 'Redis MGET error');
      return keys.map(() => null);
    }
  }

  private handleError(error: unknown, context: string): void {
    if (error instanceof Error) {
      this.logger.error(`${context}: ${error.message}`);
    } else {
      this.logger.error(`${context}: ${String(error)}`);
    }
  }
}
