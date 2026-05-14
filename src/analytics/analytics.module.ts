import { Module } from '@nestjs/common';
import { PermissionsModule } from 'src/permissions/permissions.module';
import { RepairOrderAnalyticsController } from './repair-order-analytics.controller';
import { RepairOrderAnalyticsService } from './repair-order-analytics.service';

@Module({
  imports: [PermissionsModule],
  controllers: [RepairOrderAnalyticsController],
  providers: [RepairOrderAnalyticsService],
})
export class AnalyticsModule {}
