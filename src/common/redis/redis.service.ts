// redis.service.ts
import { Injectable, Inject, Logger } from '@nestjs/common';
import { RedisClientType } from 'redis';

@Injectable()
export class RedisService {
    private readonly prefix = process.env.REDIS_PREFIX || 'procare';
    private readonly logger = new Logger(RedisService.name);

    constructor(@Inject('REDIS_CLIENT') private readonly client: RedisClientType) { }

    private buildKey(key: string): string {
        return `${this.prefix}:${key}`;
    }

    async set(key: string, value: any, ttlSeconds = 3600): Promise<void> {
        try {
            await this.client.set(this.buildKey(key), JSON.stringify(value), { EX: ttlSeconds });
        } catch (error) {
            this.logger.error(`Redis SET error for key=${key}: ${error.message}`);
        }
    }

    async get<T = any>(key: string): Promise<T | null> {
        try {
            const data = await this.client.get(this.buildKey(key));
            return typeof data === 'string' ? JSON.parse(data) : null;
        } catch (error) {
            this.logger.error(`Redis GET error for key=${key}: ${error.message}`);
            return null;
        }
    }

    async del(key: string): Promise<void> {
        try {
            await this.client.del(this.buildKey(key));
        } catch (error) {
            this.logger.error(`Redis DEL error for key=${key}: ${error.message}`);
        }
    }

    async flushByPrefix(pattern: string): Promise<void> {
        try {
            const fullPattern = this.buildKey(`${pattern}*`);
            const keys = await this.client.keys(fullPattern);

            if (keys.length > 0) {
                await Promise.all(keys.map(key => this.client.del(key)));
            }
        } catch (error) {
            this.logger.error(`Redis FLUSH error for pattern=${pattern}: ${error.message}`);
        }
    }

    getClient(): RedisClientType {
        return this.client;
    }

    async mget<T = any>(...keys: string[]): Promise<(T | null)[]> {
        try {
            const redisKeys = keys.map((k) => this.buildKey(k));
            const results = await this.client.mGet(redisKeys);

            return results.map((item: any) => (item ? JSON.parse(item) : null));
        } catch (error) {
            this.logger.error(`Redis MGET error: ${error.message}`);
            return keys.map(() => null); // Har bir key uchun null qaytaradi
        }
    }

}
