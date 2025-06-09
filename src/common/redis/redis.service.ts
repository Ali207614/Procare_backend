import { Injectable, Inject } from '@nestjs/common';
import { RedisClientType } from 'redis';

@Injectable()
export class RedisService {
    constructor(@Inject('REDIS_CLIENT') private readonly client: RedisClientType) { }

    async set(key: string, value: any, ttlSeconds = 3600): Promise<void> {
        await this.client.set(key, JSON.stringify(value), { EX: ttlSeconds });
    }

    async get<T = any>(key: string): Promise<T | null> {
        const data = await this.client.get(key);
        return typeof data === 'string' ? JSON.parse(data) : null;
    }

    async del(key: string): Promise<void> {
        await this.client.del(key);
    }

    getClient(): RedisClientType {
        return this.client;
    }
}
