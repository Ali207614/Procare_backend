import { Module } from '@nestjs/common';
import { RedisModule } from 'src/common/redis/redis.module';
import { PermissionsModule } from 'src/permissions/permissions.module';
import { AdminsController } from './admins.controller';
import { AdminsService } from './admins.service';
import { RepairOrderStatusPermissionsModule } from 'src/repair-order-status-permission/repair-order-status-permissions.module';

@Module({
  imports: [RedisModule, PermissionsModule, RepairOrderStatusPermissionsModule],
  controllers: [AdminsController],
  providers: [AdminsService],
  exports: [AdminsService, AdminsModule],
})
export class AdminsModule {}
