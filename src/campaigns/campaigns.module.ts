import { Module } from '@nestjs/common';
import { PermissionsModule } from 'src/permissions/permissions.module';
import { CampaignsController } from 'src/campaigns/campaigns.controller';
import { CampaignsService } from 'src/campaigns/campaigns.service';
import { BullModule } from '@nestjs/bull';

@Module({
  imports: [
    PermissionsModule,
    BullModule.forRoot({
      redis: {
        host: 'localhost',
        port: 6379,
      },
    }),
    BullModule.registerQueue({
      name: 'campaign-queue',
    }),
  ],
  controllers: [CampaignsController],
  providers: [CampaignsService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
