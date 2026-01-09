import { Module, OnModuleInit } from '@nestjs/common';
import { LoggerModule } from 'src/common/logger/logger.module';
import { LoggerService } from 'src/common/logger/logger.service';
import { RedisModule } from 'src/common/redis/redis.module';
import { RentalPhoneDevicesController } from './rental-phone-devices.controller';
import { RentalPhoneDevicesService } from './rental-phone-devices.service';

@Module({
  imports: [LoggerModule, RedisModule],
  controllers: [RentalPhoneDevicesController],
  providers: [RentalPhoneDevicesService],
})
export class RentalPhoneDevicesModule implements OnModuleInit {
  constructor(private readonly loggerService: LoggerService) {}
  onModuleInit(): void {
    const start = Date.now();
    try {
      const duration = Date.now() - start;

      this.loggerService.log(`✅ SAP rental phones initial sync completed (${duration}ms)`);
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.loggerService.error('❌ SAP rental phones initial sync failed', error?.stack);
      } else {
        this.loggerService.error('❌ SAP rental phones initial sync failed', String(error));
      }
    }
  }
}
