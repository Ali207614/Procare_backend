import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';
import { Module } from '@nestjs/common';
import { RedisModule } from 'src/common/redis/redis.module';
import { PermissionsModule } from 'src/permissions/permissions.module';
import { RepairOrderStatusPermissionsModule } from 'src/repair-order-status-permission/repair-order-status-permissions.module';

@Module({
  imports: [RedisModule, PermissionsModule, RepairOrderStatusPermissionsModule],
  controllers: [BranchesController],
  providers: [BranchesService],
})
export class BranchesModule {}
