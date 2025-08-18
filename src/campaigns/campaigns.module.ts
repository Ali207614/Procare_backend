import { Module } from '@nestjs/common';
import { PermissionsModule } from 'src/permissions/permissions.module';
import { CampaignsController } from 'src/campaigns/campaigns.controller';
import { CampaignsService } from 'src/campaigns/campaigns.service';

@Module({
  imports: [PermissionsModule],
  controllers: [CampaignsController],
  providers: [CampaignsService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
