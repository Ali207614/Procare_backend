import { Module } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import { RedisService } from './redis.service';
import { ConfigModule } from '@nestjs/config';

@Module({
    imports: [ConfigModule],
    providers: [
        {
            provide: 'REDIS_CLIENT',
            useFactory: async (): Promise<RedisClientType<Record<string, never>>> => {
                const client: RedisClientType<Record<string, never>> = createClient({
                    socket: {
                        host: process.env.REDIS_HOST || '127.0.0.1',
                        port: parseInt(process.env.REDIS_PORT || '6379', 10),
                    },
                    ...(process.env.REDIS_PASSWORD?.trim()
                        ? { password: process.env.REDIS_PASSWORD }
                        : {}),
                });

                client.on('error', (err) => console.error('❌ Redis Error:', err));
                await client.connect();
                return client;
            },
        },
        RedisService,
    ],
    exports: ['REDIS_CLIENT', RedisService],
})
export class RedisModule { }
