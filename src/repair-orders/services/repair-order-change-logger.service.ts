import { Injectable } from '@nestjs/common';
import type { Knex } from 'knex';

@Injectable()
export class RepairOrderChangeLoggerService {
    async logIfChanged(
        trx: Knex.Transaction,
        orderId: string,
        field: string,
        oldValue: any,
        newValue: any,
        adminId: string,
    ) {
        const isChanged =
            JSON.stringify(oldValue ?? null) !== JSON.stringify(newValue ?? null);

        if (!isChanged) return;

        await trx('repair_order_change_histories').insert({
            repair_order_id: orderId,
            field,
            old_value: JSON.stringify(oldValue),
            new_value: JSON.stringify(newValue),
            created_by: adminId,
            created_at: new Date(),
        });
    }
    async logMultipleFieldsIfChanged(
        trx: Knex.Transaction,
        orderId: string,
        fields: { key: string; oldVal: any; newVal: any }[],
        adminId: string,
    ) {
        for (const { key, oldVal, newVal } of fields) {
            await this.logIfChanged(trx, orderId, key, oldVal, newVal, adminId);
        }
    }

}
