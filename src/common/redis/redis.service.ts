import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import * as lz4 from 'lz4';
import { LoggerService } from 'src/common/logger/logger.service';

type JsonValue = unknown;

enum StoredFormat {
  RAW = 'RAW:', // siqilmagan JSON (string)
  LZ4 = 'LZ4:', // LZ4 siqilgan, base64 qilingan
}

@Injectable()
export class RedisService {
  private readonly prefix = process.env.REDIS_PREFIX || 'procare';
  // kichkina payloadlarni siqmaslik uchun pragmatik threshold
  private readonly rawThreshold = 100; // bytes (JSON uzunligiga qaraladi)

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
      const s = this.client.status; // 'connecting' | 'ready' | 'end' | 'wait' | ...
      if (s !== 'ready') {
        // ioredis v5: connect(): Promise<void>
        // ioredis v4: connect(): Promise<Redis>
        await (this.client as Redis & { connect?: () => Promise<void> }).connect?.();
      }
      if (this.client.status !== 'ready') {
        this.logger.warn(`⚠️ Redis not ready (status=${this.client.status}), skipping`);
        return false;
      }
      return true;
    } catch (err) {
      this.logger.warn(`⚠️ Redis connection failed: ${(err as Error).message}`);
      return false;
    }
  }

  /**
   * Saqlash:
   * - kichik JSON → RAW: + json
   * - katta JSON → LZ4: + base64(lz4.encode(Buffer(json)))
   */
  async set(key: string, value: JsonValue, ttlSeconds = 3600): Promise<void> {
    if (!(await this.ensureConnected())) return;

    try {
      const json = JSON.stringify(value);
      const originalSize = Buffer.byteLength(json, 'utf8');

      let payload: string;
      if (json.length < this.rawThreshold) {
        payload = StoredFormat.RAW + json;
        this.logger.log(
          `[Redis SET] key=${key} | RAW | size=${originalSize}B (~${(originalSize / 1024).toFixed(
            2,
          )} KB)`,
        );
      } else {
        const jsonBuf = Buffer.from(json, 'utf8');
        const compressed = lz4.encode(jsonBuf); // <-- Buffer kiritildi
        const compressedSize = compressed.length;

        payload = StoredFormat.LZ4 + compressed.toString('base64');
        this.logger.log(
          `[Redis SET] key=${key} | LZ4 | original=${originalSize}B (~${(
            originalSize / 1024
          ).toFixed(2)} KB) | compressed=${compressedSize}B (~${(compressedSize / 1024).toFixed(
            2,
          )} KB) | ratio=${((compressedSize / originalSize) * 100).toFixed(1)}%`,
        );
      }

      await this.client!.set(this.buildKey(key), payload, 'EX', ttlSeconds);
    } catch (err) {
      this.handleError(err, `Redis SET error for key=${key}`);
    }
  }

  /**
   * O‘qish:
   * - RAW: prefiks → oddiy JSON
   * - LZ4: prefiks → base64 → Buffer → lz4.decode → JSON
   */
  async get<T = JsonValue>(key: string): Promise<T | null> {
    if (!(await this.ensureConnected())) return null;

    try {
      const data = await this.client!.get(this.buildKey(key));
      if (!data) return null;

      if (data.startsWith(StoredFormat.RAW)) {
        const json = data.slice(StoredFormat.RAW.length);
        return JSON.parse(json) as T;
      }

      if (data.startsWith(StoredFormat.LZ4)) {
        const b64 = data.slice(StoredFormat.LZ4.length);
        const buf = Buffer.from(b64, 'base64');
        const decodedBuf = lz4.decode(buf);
        const json = decodedBuf.toString('utf8');
        return JSON.parse(json) as T;
      }

      throw new Error('Unknown data format prefix');
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

  /**
   * Prefiks bo‘yicha tozalash (SCAN asosida).
   * Katta setlarda COUNT bilan bosqichma-bosqich yuradi.
   */
  async flushByPrefix(pattern: string, scanCount = 500): Promise<void> {
    if (!(await this.ensureConnected())) return;

    try {
      const fullPattern = this.buildKey(`${pattern}*`);
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.client!.scan(
          cursor,
          'MATCH',
          fullPattern,
          'COUNT',
          scanCount,
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.client!.del(...keys);
        }
      } while (cursor !== '0');
    } catch (err) {
      this.handleError(err, `Redis FLUSH error for pattern=${pattern}`);
    }
  }

  private handleError(error: unknown, context: string): void {
    const msg = error instanceof Error ? error.message : String(error);
    this.logger.error(`${context}: ${msg}`);
  }
}
