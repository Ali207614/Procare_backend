import { Module } from '@nestjs/common';
import { PermissionsModule } from 'src/permissions/permissions.module';
import { CampaignsController } from 'src/campaigns/campaigns.controller';
import { CampaignsService } from 'src/campaigns/campaigns.service';
import { LoggerModule } from 'src/common/logger/logger.module';
import { CampaignsProcessor } from 'src/campaigns/campaign.processor';
import { TelegramModule } from 'src/telegram/telegram.module';
import { RedisModule } from 'src/common/redis/redis.module';
import { UsersModule } from 'src/users/users.module';
import { Queue, QueueOptions } from 'bullmq';

@Module({
  imports: [LoggerModule, PermissionsModule, TelegramModule, UsersModule, RedisModule],
  controllers: [CampaignsController],
  providers: [
    CampaignsService,
    CampaignsProcessor,
    {
      provide: 'CAMPAIGNS_QUEUE',
      useFactory: (): Queue => {
        const options: QueueOptions = {
          connection: {
            host: 'localhost',
            port: 6379,
          },
          limiter: {
            max: 20,
            duration: 1000,
          },
        };

        return new Queue('campaigns', options);
      },
    },
  ],
  exports: ['CAMPAIGNS_QUEUE',CampaignsService ],
})
export class CampaignsModule {}
