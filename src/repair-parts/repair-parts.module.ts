import { Module } from '@nestjs/common';
import { RepairPartsService } from './repair-parts.service';
import { RepairPartsController } from './repair-parts.controller';
import { PermissionsModule } from 'src/permissions/permissions.module';
import { HistoryModule } from 'src/history/history.module';
import { RedisModule } from 'src/common/redis/redis.module';

@Module({
  imports: [PermissionsModule, HistoryModule, RedisModule],
  controllers: [RepairPartsController],
  providers: [RepairPartsService],
})
export class RepairPartsModule {}
