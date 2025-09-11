import { forwardRef, Module } from '@nestjs/common';
import { RedisModule } from 'src/common/redis/redis.module';
import { PermissionsModule } from 'src/permissions/permissions.module';
import { RepairOrderStatusesModule } from 'src/repair-order-statuses/repair-order-statuses.module';
import { RepairOrderStatusPermissionsController } from './repair-order-status-permissions.controller';
import { RepairOrderStatusPermissionsService } from './repair-order-status-permissions.service';
import { LoggerModule } from 'src/common/logger/logger.module';

@Module({
  imports: [
    RedisModule,
    LoggerModule,
    PermissionsModule,
    forwardRef(() => RepairOrderStatusesModule),
  ],
  controllers: [RepairOrderStatusPermissionsController],
  providers: [RepairOrderStatusPermissionsService],
  exports: [RepairOrderStatusPermissionsService],
})
export class RepairOrderStatusPermissionsModule {}
