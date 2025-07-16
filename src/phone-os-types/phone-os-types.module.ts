import { PhoneOsTypesController } from './phone-os-types.controller';
import { Module } from '@nestjs/common';
import { RedisModule } from 'src/common/redis/redis.module';
import { PermissionsModule } from 'src/permissions/permissions.module';
import { PhoneOsTypesService } from './phone-os-types.service';

@Module({
  imports: [RedisModule, PermissionsModule],
  controllers: [PhoneOsTypesController],
  providers: [PhoneOsTypesService],
  exports: [PhoneOsTypesService],
})
export class PhoneOsTypesModule {}
