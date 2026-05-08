import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';
import { Module } from '@nestjs/common';
import { RedisModule } from 'src/common/redis/redis.module';
import { PermissionsModule } from 'src/permissions/permissions.module';
import { RepairOrderStatusPermissionsModule } from 'src/repair-order-status-permission/repair-order-status-permissions.module';
import { LoggerModule } from 'src/common/logger/logger.module';
import { HistoryModule } from 'src/history/history.module';
import { BranchHierarchyService } from './branch-hierarchy.service';

@Module({
  imports: [
    RedisModule,
    PermissionsModule,
    RepairOrderStatusPermissionsModule,
    LoggerModule,
    HistoryModule,
  ],
  controllers: [BranchesController],
  providers: [BranchesService, BranchHierarchyService],
  exports: [BranchesService, BranchHierarchyService],
})
export class BranchesModule {}
