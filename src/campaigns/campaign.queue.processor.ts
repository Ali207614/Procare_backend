import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';
import { Knex } from 'knex';
import { InjectKnex } from 'nestjs-knex';
import TelegramBot, { Message } from 'node-telegram-bot-api';
import { ConfigService } from '@nestjs/config';
import { ICampaign } from 'src/common/types/campaign.interface';
import { ICampaignRecipient } from 'src/common/types/campaign-recipient.interface';
import { User } from 'src/common/types/user.interface';
import { LoggerService } from 'src/common/logger/logger.service';
import { ITemplate } from 'src/common/types/template.interface';

@Processor('campaign-queue')
export class CampaignProcessor {
  private bot: TelegramBot;
  private readonly batchSize: number;
  private readonly delayMs: number;

  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly logger: LoggerService,
    private readonly configService: ConfigService,
  ) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) throw new Error('Telegram bot token not provided');
    this.bot = new TelegramBot(token, { polling: false });

    this.batchSize = this.configService.get<number>('CAMPAIGN_BATCH_SIZE', 20);
    this.delayMs = this.configService.get<number>('CAMPAIGN_DELAY_MS', 1000);
  }

  @Process('send-campaign')
  async sendCampaign(job: Job<{ campaignId: string }>): Promise<void> {
    const { campaignId } = job.data;
    const trx = await this.knex.transaction();

    try {
      const campaign: ICampaign | undefined = await trx('campaigns')
        .where('id', campaignId)
        .first();
      if (!campaign) throw new Error('Campaign not found');

      await trx('campaigns').where('id', campaignId).update({ status: 'sending' });

      const recipients: ICampaignRecipient[] = await trx('campaign_recipient')
        .where('campaign_id', campaignId)
        .where('status', 'pending')
        .select('id', 'user_id');

      const userIds = recipients.map((r) => r.user_id);
      const users: User[] = await trx('users')
        .whereIn('id', userIds)
        .select('id', 'telegram_chat_id');
      const userMap = new Map(users.map((u) => [u.id, u.telegram_chat_id]));

      const template: ITemplate | undefined = await trx('templates')
        .where('id', campaign.template_id)
        .first();
      if (!template) throw new Error('Template not found');

      const variants = campaign.ab_test?.enabled
        ? campaign.ab_test.variants
        : [{ template_id: campaign.template_id, percentage: 100 }];
      const templateIds = variants.map((v) => v.template_id);
      const templates: ITemplate[] = await trx('templates')
        .whereIn('id', templateIds)
        .select('id', 'body');
      const templateMap = new Map(templates.map((t) => [t.id, t.body]));

      for (let i = 0; i < recipients.length; i += this.batchSize) {
        const batch: ICampaignRecipient[] = recipients.slice(i, i + this.batchSize);
        for (const recipient of batch) {
          const chatId = userMap.get(recipient.user_id);
          if (!chatId) {
            await trx('campaign_recipient')
              .where('id', recipient.id)
              .update({ status: 'failed', error: 'No Telegram chat ID', updated_at: trx.fn.now() });
            continue;
          }

          const rand = Math.random() * 100;
          let cumulative = 0;
          const selectedVariant =
            variants.find((v) => {
              cumulative += v.percentage;
              return rand <= cumulative;
            }) || variants[0];
          const message = templateMap.get(selectedVariant.template_id) || template.body;

          try {
            const sentMessage: Message = await this.bot.sendMessage(chatId, message);
            await trx('campaign_recipient').where('id', recipient.id).update({
              status: 'sent',
              message_id: sentMessage.message_id,
              sent_at: trx.fn.now(),
              updated_at: trx.fn.now(),
            });
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to send message to ${chatId}: ${errorMessage}`);
            await trx('campaign_recipient').where('id', recipient.id).update({
              status: 'failed',
              error: errorMessage,
              updated_at: trx.fn.now(),
            });
          }

          await new Promise((resolve) => setTimeout(resolve, this.delayMs));
        }
      }

      const failedCount: { count: number } | undefined = await trx('campaign_recipient')
        .where('campaign_id', campaignId)
        .where('status', 'failed')
        .count<{ count: number }>('* as count')
        .first();
      const status: 'failed' | 'completed' = (failedCount?.count ?? 0) > 0 ? 'failed' : 'completed';
      await trx('campaigns').where('id', campaignId).update({ status, updated_at: trx.fn.now() });

      await trx.commit();
    } catch (error: unknown) {
      await trx.rollback();
      this.logger.error(`Campaign processing failed: ${(error as Error).message}`);
      throw error;
    }
  }

  @OnQueueFailed()
  async onQueueFailed(job: Job<{ campaignId: string }>, error: Error): Promise<void> {
    const { campaignId } = job.data;
    if (!campaignId) {
      this.logger.error(`Invalid job data: ${error.message}`);
      return;
    }

    const trx = await this.knex.transaction();
    try {
      await trx('campaign_recipient')
        .where('campaign_id', campaignId)
        .where('status', 'pending')
        .update({ status: 'failed', error: 'Queue failed', updated_at: trx.fn.now() });

      await trx('campaigns')
        .where('id', campaignId)
        .update({ status: 'failed', updated_at: trx.fn.now() });

      await trx.commit();
      this.logger.log(`Campaign ${campaignId} marked as failed`);
    } catch (dbError: unknown) {
      await trx.rollback();
      this.logger.error(`Failed to update campaign ${campaignId}: ${(dbError as Error).message}`);
    }
  }
}
