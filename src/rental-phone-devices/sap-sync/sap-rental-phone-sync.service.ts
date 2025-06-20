import { Injectable } from '@nestjs/common';
import { InjectKnex, Knex } from 'nestjs-knex';
import { LoggerService } from 'src/common/logger/logger.service';
import { loadSQL } from 'src/common/utils/sql-loader.util';
import { executeOnce } from 'src/common/utils/hana.util';

@Injectable()
export class SapRentalPhoneSyncService {

    constructor(@InjectKnex() private readonly knex: Knex, private readonly loggerService: LoggerService) { }

    async syncFromSap(): Promise<void> {
        const query = loadSQL('rental-phone-devices/queries/sap-rental-phone-sync.sql');
        const sapPhones = await executeOnce(query, []);

        const now = new Date();

        const rowsToUpsert = sapPhones.map(row => ({
            code: row.code,
            name: row.name,
            is_free: row.is_free === 'Y' || row.is_free === true,
            price: row.price ?? null,
            currency: row.currency ?? null,
            is_available: true,
            is_synced_from_sap: true,
            updated_at: now,
            created_at: now,
        }));

        const sapCodes = sapPhones.map(row => row.code);

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

        this.loggerService.log(`✅ SAP rental phones synced: ${sapPhones.length} items`);
    }

}
