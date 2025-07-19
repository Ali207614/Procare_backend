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
      useFactory: (): Redis => {
        const client = new Redis({
          host: process.env.REDIS_HOST || '127.0.0.1',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          password: process.env.REDIS_PASSWORD?.trim() || undefined,
          lazyConnect: true,
          reconnectOnError: () => false,
          maxRetriesPerRequest: 0,
        });

        client.on('error', (err) => {
          console.error('❌ Redis Error:', err.message);
        });

        client.on('connect', () => {
          console.log('✅ Redis connection established');
        });

        return client;
      },
    },
    RedisService,
  ],
  exports: ['REDIS_CLIENT', RedisService],
})
export class RedisModule {}
