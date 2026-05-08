// campaigns.module.ts
import { Module } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';
import { LoggerModule } from 'src/common/logger/logger.module';
import { TelegramModule } from 'src/telegram/telegram.module';
import { UsersModule } from 'src/users/users.module';
import { RedisModule } from 'src/common/redis/redis.module';
import { PermissionsModule } from 'src/permissions/permissions.module';

@Module({
  imports: [
    LoggerModule,
    TelegramModule,
    UsersModule,
    RedisModule,
    PermissionsModule,
    ConfigModule.forRoot({ isGlobal: true }),
  ],
  controllers: [CampaignsController],
  providers: [
    CampaignsService,
    {
      provide: 'CAMPAIGNS_QUEUE',
      inject: [ConfigService],
      useFactory: (config: ConfigService): Queue =>
        new Queue('campaigns', {
          connection: {
            host: config.get<string>('REDIS_HOST') || 'localhost',
            port: Number(config.get('REDIS_PORT')) || 6379,
          },
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: 200,
            removeOnFail: false,
          },
        }),
    },
  ],
  exports: ['CAMPAIGNS_QUEUE', CampaignsService],
})
export class CampaignsModule {}
