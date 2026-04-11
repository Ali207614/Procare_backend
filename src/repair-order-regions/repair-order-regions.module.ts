import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/common/logger/logger.module';
import { RedisModule } from 'src/common/redis/redis.module';
import { PermissionsModule } from 'src/permissions/permissions.module';
import { RepairOrderRegionsController } from './repair-order-regions.controller';
import { RepairOrderRegionsService } from './repair-order-regions.service';

@Module({
  imports: [RedisModule, LoggerModule, PermissionsModule],
  controllers: [RepairOrderRegionsController],
  providers: [RepairOrderRegionsService],
  exports: [RepairOrderRegionsService],
})
export class RepairOrderRegionsModule {}
