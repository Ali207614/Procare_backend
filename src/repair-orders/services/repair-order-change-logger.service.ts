import { Injectable } from '@nestjs/common';
import { InjectKnex } from 'nestjs-knex';
import type { Knex } from 'knex';
import { LoggerService } from 'src/common/logger/logger.service';
import { RepairOrderChangeHistory } from 'src/common/types/repair-order-change-history.interface';
import { HistoryService } from 'src/history/history.service';
import { HistoryScalarValue, HistoryValueType } from 'src/history/types/history.types';
import { RepairOrderHistoryCommentManager } from 'src/repair-orders/utils/repair-order-history-comment-manager';

@Injectable()
export class RepairOrderChangeLoggerService {
  private readonly historyCommentManager: RepairOrderHistoryCommentManager;

  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly logger: LoggerService,
    private readonly historyService: HistoryService,
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
    await this.logGlobalHistoryChange(trx, orderId, field, oldValue, newValue, adminId);
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
    await this.logGlobalHistoryChange(trx, orderId, action, null, data, adminId);
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

  private async logGlobalHistoryChange(
    trx: Knex.Transaction | Knex,
    orderId: string,
    field: string,
    oldValue: unknown,
    newValue: unknown,
    adminId: string,
  ): Promise<void> {
    const valueType = this.inferHistoryValueType(field, newValue ?? oldValue);

    await this.historyService.createEvent(
      {
        actionKey: `repair_orders.${field}`,
        actionKind:
          oldValue == null && newValue != null ? 'create' : newValue == null ? 'delete' : 'update',
        sourceType: 'admin_api',
        sourceName: 'repair_order_change_logger',
        rootEntityTable: 'repair_orders',
        rootEntityPk: orderId,
        actors: [
          {
            actorRole: 'initiator',
            actorType: 'admin',
            actorTable: 'admins',
            actorPk: adminId,
          },
        ],
        entities: [
          {
            key: 'repair_order',
            entityTable: 'repair_orders',
            entityPk: orderId,
            entityRole: 'primary_target',
            rootEntityTable: 'repair_orders',
            rootEntityPk: orderId,
            beforeExists: true,
            afterExists: true,
          },
        ],
        changes: [
          {
            eventEntityKey: 'repair_order',
            entityTable: 'repair_orders',
            entityPk: orderId,
            fieldPath: field,
            operation:
              oldValue == null && newValue != null
                ? 'insert'
                : newValue == null
                  ? 'delete'
                  : 'update',
            valueType,
            oldValue: this.toHistoryScalar(field, valueType, oldValue),
            newValue: this.toHistoryScalar(field, valueType, newValue),
          },
        ],
      },
      trx,
    );
  }

  private toHistoryScalar(
    field: string,
    valueType: HistoryValueType,
    value: unknown,
  ): HistoryScalarValue {
    const refTable = this.referenceTableForField(field);

    return {
      valueType,
      valueText: this.toScalarText(value),
      refTable,
      refPk: valueType === 'reference' && typeof value === 'string' ? value : null,
    };
  }

  private toScalarText(value: unknown): string | number | boolean | Date | null {
    if (value == null) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    return JSON.stringify(value);
  }

  private inferHistoryValueType(field: string, value: unknown): HistoryValueType {
    if (value == null) return 'null';
    if (field.endsWith('_id') || field.endsWith('_ids')) return 'reference';
    if (field.toLowerCase().includes('phone')) return 'phone';
    if (value instanceof Date) return 'timestamp';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'decimal';

    if (typeof value === 'string') {
      if (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
      ) {
        return 'uuid';
      }
      if (/^-?\d+$/.test(value)) return 'integer';
      if (/^-?\d+\.\d+$/.test(value)) return 'decimal';
    }

    return 'text';
  }

  private referenceTableForField(field: string): string | null {
    const references: Record<string, string> = {
      user_id: 'users',
      branch_id: 'branches',
      phone_category_id: 'phone_categories',
      status_id: 'repair_order_statuses',
      created_by: 'admins',
      updated_by: 'admins',
      admin_id: 'admins',
      admin_ids: 'admins',
      role_id: 'roles',
      permission_id: 'permissions',
    };

    return references[field] ?? null;
  }
}
