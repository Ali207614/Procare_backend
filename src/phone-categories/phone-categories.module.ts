import { Module } from '@nestjs/common';
import { PhoneCategoriesService } from './phone-categories.service';
import { PhoneCategoriesController } from './phone-categories.controller';
import { PermissionsModule } from 'src/permissions/permissions.module';
import { PhoneOsTypesModule } from 'src/phone-os-types/phone-os-types.module';
import { RedisModule } from 'src/common/redis/redis.module';
import { LoggerModule } from 'src/common/logger/logger.module';

@Module({
  imports: [PermissionsModule, PhoneOsTypesModule, RedisModule, LoggerModule],
  controllers: [PhoneCategoriesController],
  providers: [PhoneCategoriesService],
})
export class PhoneCategoriesModule {}
