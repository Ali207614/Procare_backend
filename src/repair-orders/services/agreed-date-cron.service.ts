import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import { LoggerService } from 'src/common/logger/logger.service';
import { RepairOrder } from 'src/common/types/repair-order.interface';
import { NotificationGateway } from 'src/notification/notification.gateway';
import { RepairOrderCreateHelperService } from './repair-order-create-helper.service';
import { RedisService } from 'src/common/redis/redis.service';
import { BroadcastMessage, RepairNotificationMeta } from 'src/common/types/notification.interface';
import { formatPgTimestampLocal } from 'src/common/utils/agreed-date.util';

interface AgreedDateStatusId {
  status_id: string;
}

@Injectable()
export class AgreedDateCronService {
  private readonly table = 'repair_orders';

  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly logger: LoggerService,
    private readonly gateway: NotificationGateway,
    private readonly helper: RepairOrderCreateHelperService,
    private readonly redisService: RedisService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleAgreedDateTrigger(): Promise<void> {
    this.logger.log('[AgreedDateCron] Running agreed_date hourly check...');

    try {
      // 1. Find all status IDs that have cannot_continue_without_agreed_date enabled
      const statusRows: AgreedDateStatusId[] = await this.knex('repair_order_status_permissions')
        .where({ cannot_continue_without_agreed_date: true })
        .distinct('status_id')
        .select('status_id');

      if (!statusRows.length) {
        this.logger.log(
          '[AgreedDateCron] No statuses with agreed_date permission found. Skipping.',
        );
        return;
      }

      const statusIds = statusRows.map((row) => row.status_id);

      // 2. Build the current hour window (e.g., "2026-03-25 09:00" to "2026-03-25 09:59")
      const now = new Date();
      const currentHourStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        now.getHours(),
        0,
        0,
      );
      const currentHourEnd = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        now.getHours(),
        59,
        59,
      );
      const currentHourStartSql = formatPgTimestampLocal(currentHourStart);
      const currentHourEndSql = formatPgTimestampLocal(currentHourEnd);

      // 3. Find all open repair orders in those statuses whose agreed_date falls within the current hour
      const matchingOrders: RepairOrder[] = await this.knex<RepairOrder>(this.table)
        .whereIn('status_id', statusIds)
        .andWhere('status', 'Open')
        .whereNotNull('agreed_date')
        .andWhere('agreed_date', '>=', currentHourStartSql)
        .andWhere('agreed_date', '<=', currentHourEndSql);

      if (!matchingOrders.length) {
        this.logger.log(
          '[AgreedDateCron] No repair orders with matching agreed_date found. Skipping.',
        );
        return;
      }

      this.logger.log(
        `[AgreedDateCron] Found ${matchingOrders.length} repair order(s) to trigger.`,
      );

      // 4. Process each matching order
      const affectedBranchIds = new Set<string>();

      for (const order of matchingOrders) {
        const trx = await this.knex.transaction();
        try {
          // Move order to top (sort = 1)
          await this.moveToTop(trx, order);
          await trx.commit();

          affectedBranchIds.add(order.branch_id);

          // 5. Send socket notification with is_trigger: true
          const richMeta = await this.helper.getRepairOrderNotificationMeta(order.id);
          if (richMeta) {
            const payload: BroadcastMessage<RepairNotificationMeta & { is_trigger: boolean }> = {
              title: 'Kelishilgan vaqt yetib keldi',
              message: `Buyurtma #${order.number_id} uchun kelishilgan vaqt yetib keldi`,
              meta: {
                ...richMeta,
                is_trigger: true,
              },
            };

            this.gateway.broadcastToBranch(order.branch_id, payload);
          }

          this.logger.log(
            `[AgreedDateCron] Moved order ${order.id} (#${order.number_id}) to top and notified branch ${order.branch_id}.`,
          );
        } catch (error) {
          await trx.rollback();
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(`[AgreedDateCron] Failed to process order ${order.id}: ${message}`);
        }
      }

      // 6. Flush Redis cache for affected branches
      for (const branchId of affectedBranchIds) {
        await this.redisService.flushByPrefix(`${this.table}:${branchId}`);
      }

      this.logger.log(
        `[AgreedDateCron] Completed. Processed ${matchingOrders.length} order(s) across ${affectedBranchIds.size} branch(es).`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[AgreedDateCron] Unexpected error: ${message}`);
    }
  }

  /**
   * Moves a repair order to the top of its status list (sort = 1).
   * Shifts existing items that were above this one.
   */
  private async moveToTop(trx: Knex.Transaction, order: RepairOrder): Promise<void> {
    if (order.sort === 1) return;

    // Shift all orders currently above this one down by 1
    await trx(this.table)
      .where({
        branch_id: order.branch_id,
        status_id: order.status_id,
        status: 'Open',
      })
      .andWhere('sort', '<', order.sort)
      .increment('sort', 1);

    // Set this order's sort to 1
    await trx(this.table).where({ id: order.id }).update({ sort: 1 });
  }
}
