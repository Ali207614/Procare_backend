import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import * as lz4 from 'lz4';
import { LoggerService } from 'src/common/logger/logger.service';

@Injectable()
export class RedisService {
  private readonly prefix = process.env.REDIS_PREFIX || 'procare';

  constructor(
    @Inject('REDIS_CLIENT') private readonly client: Redis | null,
    private readonly logger: LoggerService,
  ) {}

  private buildKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  private async ensureConnected(): Promise<boolean> {
    if (!this.client) {
      this.logger.warn('⚠️ Redis client is null, skipping operation');
      return false;
    }

    try {
      if (this.client.status !== 'ready') {
        await this.client.connect();
      }
      return true;
    } catch (err) {
      this.logger.warn('⚠️ Redis connection failed, skipping operation');
      return false;
    }
  }

  async set(key: string, value: unknown, ttlSeconds = 3600): Promise<void> {
    if (!(await this.ensureConnected())) return;

    try {
      const json = JSON.stringify(value);
      const dataToStore = json.length < 100 ? json : lz4.encode(json); // 100 baytdan kichik bo‘lsa siqmaslik
      console.log(`Original size=${json.length}, Stored size=${dataToStore.length}`);
      await this.client!.set(this.buildKey(key), dataToStore, 'EX', ttlSeconds);
    } catch (err) {
      this.handleError(err, `Redis SET error for key=${key}`);
    }
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    if (!(await this.ensureConnected())) return null;

    try {
      const data = await this.client!.getBuffer(this.buildKey(key));
      if (!data) return null;
      let decompressed: string;
      try {
        decompressed = lz4.decode(data).toString('utf8');
      } catch (e) {
        decompressed = data.toString('utf8');
      }
      return JSON.parse(decompressed) as T;
    } catch (err) {
      this.handleError(err, `Redis GET error for key=${key}`);
      return null;
    }
  }

  async del(key: string): Promise<void> {
    if (!(await this.ensureConnected())) return;

    try {
      await this.client!.del(this.buildKey(key));
    } catch (err) {
      this.handleError(err, `Redis DEL error for key=${key}`);
    }
  }

  async flushByPrefix(pattern: string): Promise<void> {
    if (!(await this.ensureConnected())) return;

    try {
      const fullPattern = this.buildKey(`${pattern}*`);
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.client!.scan(cursor, 'MATCH', fullPattern);
        if (keys.length > 0) {
          await this.client!.del(...keys);
        }
        cursor = nextCursor;
      } while (cursor !== '0');
    } catch (err) {
      this.handleError(err, `Redis FLUSH error for pattern=${pattern}`);
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
