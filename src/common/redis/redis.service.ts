// redis.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { RedisClientType } from 'redis';

@Injectable()
export class RedisService {
    private readonly prefix = process.env.REDIS_PREFIX || 'procare'; // projectga mos prefix

    constructor(@Inject('REDIS_CLIENT') private readonly client: RedisClientType) { }

    private buildKey(key: string): string {
        return `${this.prefix}:${key}`;
    }

    async set(key: string, value: any, ttlSeconds = 3600): Promise<void> {
        await this.client.set(this.buildKey(key), JSON.stringify(value), { EX: ttlSeconds });
    }

    async get<T = any>(key: string): Promise<T | null> {
        const data = await this.client.get(this.buildKey(key));
        return typeof data === 'string' ? JSON.parse(data) : null;
    }

    async del(key: string): Promise<void> {
        await this.client.del(this.buildKey(key));
    }

    async flushByPrefix(pattern: string): Promise<void> {
        const fullPattern = this.buildKey(`${pattern}*`);
        const keys = await this.client.keys(fullPattern);

        if (keys.length > 0) {
            await Promise.all(keys.map(key => this.client.del(key)));
        }
    }



    getClient(): RedisClientType {
        return this.client;
    }
}
