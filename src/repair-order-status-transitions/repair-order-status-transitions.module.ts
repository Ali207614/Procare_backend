import { RepairOrderStatusTransitionsController } from './repair-order-status-transitions.controller';
import { Module } from '@nestjs/common';
import { RedisModule } from 'src/common/redis/redis.module';
import { PermissionsModule } from 'src/permissions/permissions.module';
import { RepairOrderStatusesModule } from 'src/repair-order-statuses/repair-order-statuses.module';
import { RepairOrderStatusTransitionsService } from './repair-order-status-transitions.service';
import { LoggerModule } from 'src/common/logger/logger.module';

@Module({
  imports: [RedisModule, PermissionsModule, RepairOrderStatusesModule, LoggerModule],
  controllers: [RepairOrderStatusTransitionsController],
  providers: [RepairOrderStatusTransitionsService],
})
export class RepairOrderStatusTransitionsModule {}
