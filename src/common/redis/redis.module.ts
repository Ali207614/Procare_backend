import { Module, Global } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisService } from './redis.service';
import { ConfigModule } from '@nestjs/config';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: async (): Promise<Redis | null> => {
        const client = new Redis({
          host: process.env.REDIS_HOST || '127.0.0.1',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          password: process.env.REDIS_PASSWORD?.trim() || undefined,
          lazyConnect: true,
          enableOfflineQueue: false,
          reconnectOnError: () => false,
          maxRetriesPerRequest: 0,
          retryStrategy: () => null,
        });

        client.on('error', (err) => {
          console.warn('⚠️ Redis client internal error:', err.message);
        });

        try {
          await client.connect();
          console.log('✅ Redis connected');
          return client;
        } catch (err: unknown) {
          console.error('❌ Redis connect error:', err instanceof Error ? err.message : err);
          return null;
        }
      },
    },
    RedisService,
  ],
  exports: ['REDIS_CLIENT', RedisService],
})
export class RedisModule {}
