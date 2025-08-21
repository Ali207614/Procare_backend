import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CampaignSchedulerService } from './campaign-scheduler.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [CampaignSchedulerService],
})
export class CampaignSchedulerModule {}
