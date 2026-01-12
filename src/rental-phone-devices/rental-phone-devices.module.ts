import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/common/logger/logger.module';
import { RedisModule } from 'src/common/redis/redis.module';
import { PermissionsModule } from 'src/permissions/permissions.module';
import { RentalPhoneDevicesController } from './rental-phone-devices.controller';
import { RentalPhoneDevicesService } from './rental-phone-devices.service';

@Module({
  imports: [LoggerModule, RedisModule, PermissionsModule],
  controllers: [RentalPhoneDevicesController],
  providers: [RentalPhoneDevicesService],
  exports: [RentalPhoneDevicesService],
})
export class RentalPhoneDevicesModule {}
