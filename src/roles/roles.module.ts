import { Module } from '@nestjs/common';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { RedisModule } from 'src/common/redis/redis.module';
import { PermissionsModule } from 'src/permissions/permissions.module';
import { RepairOrderStatusPermissionsModule } from 'src/repair-order-status-permission/repair-order-status-permissions.module';

@Module({
  imports: [RedisModule, PermissionsModule, RepairOrderStatusPermissionsModule],
  controllers: [RolesController],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
