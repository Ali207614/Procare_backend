import { forwardRef, Module } from '@nestjs/common';
import { RepairOrderStatusesService } from './repair-order-statuses.service';
import { RepairOrderStatusesController } from './repair-order-statuses.controller';
import { RedisModule } from 'src/common/redis/redis.module';
import { PermissionsModule } from 'src/permissions/permissions.module';
import { RepairOrderStatusPermissionsModule } from 'src/repair-order-status-permission/repair-order-status-permissions.module';

@Module({
  imports: [RedisModule, PermissionsModule, forwardRef(() => RepairOrderStatusPermissionsModule)],
  controllers: [RepairOrderStatusesController],
  providers: [RepairOrderStatusesService],
  exports: [RepairOrderStatusesService],
})
export class RepairOrderStatusesModule {}
