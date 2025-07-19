import { Injectable } from '@nestjs/common';
import { InjectKnex, Knex } from 'nestjs-knex';
import { LoggerService } from 'src/common/logger/logger.service';
import { loadSQL } from 'src/common/utils/sql-loader.util';
import { executeOnce } from 'src/common/utils/hana.util';

export interface RentalPhoneDeviceView {
  Code: string;
  U_ItemCode: string;
  U_ItemName: string;
  ItemCode: string;
  ItemName: string;
  OnHand: number;
  U_IS_FREE: string;
  U_PRICE: number;
  U_IS_AVAILABLE: string;
}

@Injectable()
export class SapRentalPhoneSyncService {
  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly loggerService: LoggerService,
  ) {}

  async syncFromSap(): Promise<void> {
    const start = Date.now();

    try {
      let query = loadSQL('rental-phone-devices/queries/sap-rental-phone-sync.sql');
      const schema = process.env.SAP_SCHEMA || 'PROBOX_PROD_3';
      query = query.replace(/{{schema}}/g, schema);

      const sapPhones: RentalPhoneDeviceView[] = await executeOnce(query, []);
      const now = new Date();

      const rowsToUpsert = sapPhones.map((row) => ({
        code: row.ItemCode,
        name: row.ItemName,
        is_free: row.U_IS_FREE === 'YES',
        price: row.U_PRICE ?? null,
        currency: 'UZS',
        is_available: true,
        is_synced_from_sap: true,
        updated_at: now,
        created_at: now,
      }));

      const sapCodes: string[] = sapPhones.map((row) => row.ItemCode);

      await this.knex('rental_phone_devices')
        .insert(rowsToUpsert)
        .onConflict('code')
        .merge([
          'name',
          'is_free',
          'price',
          'currency',
          'is_available',
          'is_synced_from_sap',
          'updated_at',
        ]);

      await this.knex('rental_phone_devices')
        .whereNotIn('code', sapCodes)
        .andWhere('is_synced_from_sap', true)
        .update({ is_available: false, updated_at: now });

      const duration = Date.now() - start;
      this.loggerService.log(
        `✅ SAP rental phones synced: ${sapPhones.length} items (${duration}ms)`,
      );
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.loggerService.error('❌ SAP rental phone sync failed', error.stack);
      } else {
        this.loggerService.error('❌ SAP rental phone sync failed', String(error));
      }
      throw error;
    }
  }
}
