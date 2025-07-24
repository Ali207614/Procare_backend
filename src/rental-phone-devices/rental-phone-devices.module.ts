import { Module, OnModuleInit } from '@nestjs/common';
import { RentalPhoneDevicesService } from './rental-phone-devices.service';
import { RentalPhoneDevicesController } from './rental-phone-devices.controller';
import { SapRentalPhoneSyncService } from './sap-sync/sap-rental-phone-sync.service';
import { RentalPhoneSyncTask } from './tasks/rental-phone-sync.task';
import { LoggerModule } from 'src/common/logger/logger.module';
import { LoggerService } from 'src/common/logger/logger.service';
import { RedisModule } from 'src/common/redis/redis.module';

@Module({
  imports: [LoggerModule, RedisModule],
  controllers: [RentalPhoneDevicesController],
  providers: [RentalPhoneDevicesService, SapRentalPhoneSyncService, RentalPhoneSyncTask],
})
export class RentalPhoneDevicesModule implements OnModuleInit {
  constructor(
    private readonly sapSyncService: SapRentalPhoneSyncService,
    private readonly loggerService: LoggerService,
  ) {}

  async onModuleInit(): Promise<void> {
    const start = Date.now();
    try {
      // await this.sapSyncService.syncFromSap();
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
