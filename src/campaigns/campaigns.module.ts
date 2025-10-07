// src/campaigns/campaigns.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PermissionsModule } from 'src/permissions/permissions.module';
import { CampaignsController } from 'src/campaigns/campaigns.controller';
import { CampaignsService } from 'src/campaigns/campaigns.service';
import { LoggerModule } from 'src/common/logger/logger.module';
import { CampaignsProcessor } from 'src/campaigns/campaign.processor';
import { TelegramModule } from 'src/telegram/telegram.module';
import { RedisModule } from 'src/common/redis/redis.module';
import { UsersModule } from 'src/users/users.module';
import { Queue } from 'bullmq';

@Module({
  imports: [
    LoggerModule,
    PermissionsModule,
    TelegramModule,
    UsersModule,
    RedisModule,
    ConfigModule.forRoot({ isGlobal: true }),
  ],
  controllers: [CampaignsController],
  providers: [
    CampaignsService,
    CampaignsProcessor,
    {
      provide: 'CAMPAIGNS_QUEUE',
      inject: [ConfigService],
      useFactory: (config: ConfigService): Queue => {
        return new Queue('campaigns', {
          connection: {
            host: 'localhost',
            port: 6379,
          },
          rateLimit: {
            max: 20,
            duration: 1000,
          },
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: true,
            removeOnFail: false,
          },
        } as any);
      },
    },
  ],
  exports: ['CAMPAIGNS_QUEUE', CampaignsService],
})
export class CampaignsModule {}
