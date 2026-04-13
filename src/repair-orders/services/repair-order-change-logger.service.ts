import { Injectable } from '@nestjs/common';
import { InjectKnex } from 'nestjs-knex';
import type { Knex } from 'knex';
import { LoggerService } from 'src/common/logger/logger.service';
import { RepairOrderChangeHistory } from 'src/common/types/repair-order-change-history.interface';
import { RepairOrderHistoryCommentManager } from 'src/repair-orders/utils/repair-order-history-comment-manager';

@Injectable()
export class RepairOrderChangeLoggerService {
  private readonly historyCommentManager: RepairOrderHistoryCommentManager;

  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly logger: LoggerService,
  ) {
    this.historyCommentManager = new RepairOrderHistoryCommentManager(knex, logger);
  }

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

    const [history] = await trx<RepairOrderChangeHistory>('repair_order_change_histories')
      .insert({
        repair_order_id: orderId,
        field,
        old_value: this.toJsonValue(oldValue),
        new_value: this.toJsonValue(newValue),
        created_by: adminId,
        created_at: new Date(),
      })
      .returning('*');

    await this.historyCommentManager.ensureCommentForHistory(trx, history);
  }

  async logMultipleFieldsIfChanged(
    trx: Knex.Transaction | Knex,
    orderId: string,
    fields: { key: string; oldVal: unknown; newVal: unknown }[],
    adminId: string,
  ): Promise<void> {
    for (const { key, oldVal, newVal } of fields) {
      await this.logIfChanged(trx, orderId, key, oldVal, newVal, adminId);
    }
  }

  async logAction(
    trx: Knex.Transaction | Knex,
    orderId: string,
    action: string,
    data: unknown,
    adminId: string,
  ): Promise<void> {
    const [history] = await trx<RepairOrderChangeHistory>('repair_order_change_histories')
      .insert({
        repair_order_id: orderId,
        field: action,
        old_value: null,
        new_value: this.toJsonValue(data),
        created_by: adminId,
        created_at: new Date(),
      })
      .returning('*');

    await this.historyCommentManager.ensureCommentForHistory(trx, history);
  }

  async logChange(orderId: string, action: string, data: unknown, adminId: string): Promise<void> {
    await this.logAction(this.knex, orderId, action, data, adminId);
  }

  async backfillMissingHistoryComments(batchSize = 200): Promise<{
    processed: number;
    created: number;
    skipped: number;
  }> {
    return this.historyCommentManager.backfillMissingComments(batchSize);
  }

  private toJsonValue(value: unknown): string | null {
    if (value == null) return null;
    return JSON.stringify(value);
  }
}
