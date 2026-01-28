import { Injectable } from '@nestjs/common';
import { InjectKnex } from 'nestjs-knex';
import type { Knex } from 'knex';

@Injectable()
export class RepairOrderChangeLoggerService {
  constructor(@InjectKnex() private readonly knex: Knex) {}
  async logIfChanged(
    trx: Knex.Transaction | Knex,
    orderId: string,
    field: string,
    oldValue: unknown,
    newValue: unknown,
    adminId: string,
  ): Promise<void> {
    const isChanged = JSON.stringify(oldValue ?? null) !== JSON.stringify(newValue ?? null);

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
    fields: { key: string; oldVal: unknown; newVal: unknown }[],
    adminId: string,
  ): Promise<void> {
    for (const { key, oldVal, newVal } of fields) {
      await this.logIfChanged(trx, orderId, key, oldVal, newVal, adminId);
    }
  }

  async logChange(orderId: string, action: string, data: unknown, adminId: string): Promise<void> {
    await this.knex('repair_order_change_histories').insert({
      repair_order_id: orderId,
      field: action,
      old_value: null,
      new_value: JSON.stringify(data),
      created_by: adminId,
      created_at: new Date(),
    });
  }
}
