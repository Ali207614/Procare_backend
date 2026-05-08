import { PhoneOsTypesController } from './phone-os-types.controller';
import { Module } from '@nestjs/common';
import { RedisModule } from 'src/common/redis/redis.module';
import { PermissionsModule } from 'src/permissions/permissions.module';
import { PhoneOsTypesService } from './phone-os-types.service';
import { LoggerModule } from 'src/common/logger/logger.module';
import { HistoryModule } from 'src/history/history.module';

@Module({
  imports: [RedisModule, PermissionsModule, LoggerModule, HistoryModule],
  controllers: [PhoneOsTypesController],
  providers: [PhoneOsTypesService],
  exports: [PhoneOsTypesService],
})
export class PhoneOsTypesModule {}
