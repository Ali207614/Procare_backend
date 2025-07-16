import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SapRentalPhoneSyncService } from '../sap-sync/sap-rental-phone-sync.service';

@Injectable()
export class RentalPhoneSyncTask {
  constructor(private readonly sapSyncService: SapRentalPhoneSyncService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleSync(): Promise<void> {
    await this.sapSyncService.syncFromSap();
  }
}
