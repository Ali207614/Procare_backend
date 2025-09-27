import { Module } from '@nestjs/common';
import { PermissionsModule } from 'src/permissions/permissions.module';
import { CampaignsController } from 'src/campaigns/campaigns.controller';
import { CampaignsService } from 'src/campaigns/campaigns.service';
import { BullModule } from '@nestjs/bullmq';
import { LoggerModule } from 'src/common/logger/logger.module';
import { CampaignsProcessor } from 'src/campaigns/campaign.processor';
import { TelegramModule } from 'src/telegram/telegram.module';
import { RedisModule } from 'src/common/redis/redis.module';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    LoggerModule,
    PermissionsModule,
    TelegramModule,
    UsersModule,
    BullModule.registerQueue({
      name: 'campaigns',
    }),
    RedisModule,
  ],
  controllers: [CampaignsController],
  providers: [CampaignsService, CampaignsProcessor],
  exports: [CampaignsService, BullModule],
})
export class CampaignsModule {}
