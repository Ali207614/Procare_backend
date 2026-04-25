import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import { LoggerService } from 'src/common/logger/logger.service';
import { RepairOrdersService } from '../repair-orders.service';

@Injectable()
export class CustomerNoAnswerCronService {
  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly logger: LoggerService,
    private readonly repairOrdersService: RepairOrdersService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleDueCustomerNoAnswers(): Promise<void> {
    try {
      const dueOrders = await this.knex('repair_orders')
        .where({ status: 'Open' })
        .whereNotNull('customer_no_answer_due_at')
        .andWhere('customer_no_answer_count', '>', 0)
        .andWhere('customer_no_answer_due_at', '<=', this.knex.fn.now())
        .select<{ id: string }[]>('id')
        .limit(200);

      if (!dueOrders.length) return;

      this.logger.log(`[CustomerNoAnswerCron] Processing ${dueOrders.length} due repair order(s).`);

      for (const order of dueOrders) {
        try {
          await this.repairOrdersService.processDueCustomerNoAnswer(order.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(
            `[CustomerNoAnswerCron] Failed to process repair order ${order.id}: ${message}`,
          );
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[CustomerNoAnswerCron] Unexpected error: ${message}`);
    }
  }
}
