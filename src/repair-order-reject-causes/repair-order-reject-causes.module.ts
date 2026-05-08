import { Module } from '@nestjs/common';
import { RepairOrderRejectCausesService } from './repair-order-reject-causes.service';
import { RepairOrderRejectCausesController } from './repair-order-reject-causes.controller';
import { RedisModule } from 'src/common/redis/redis.module';
import { LoggerModule } from 'src/common/logger/logger.module';
import { PermissionsModule } from 'src/permissions/permissions.module';
import { HistoryModule } from 'src/history/history.module';

@Module({
  imports: [RedisModule, LoggerModule, PermissionsModule, HistoryModule],
  controllers: [RepairOrderRejectCausesController],
  providers: [RepairOrderRejectCausesService],
  exports: [RepairOrderRejectCausesService],
})
export class RepairOrderRejectCausesModule {}
