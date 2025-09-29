import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import { LoggerService } from 'src/common/logger/logger.service';
import { TelegramService } from 'src/telegram/telegram.service';
import { User } from 'src/common/types/user.interface';
import { ITemplate } from 'src/common/types/template.interface';
import { ICampaignRecipient } from 'src/common/types/campaign-recipient.interface';

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('campaigns')
export class CampaignsProcessor extends WorkerHost {
  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly logger: LoggerService,
    private readonly telegramService: TelegramService,
  ) {
    super();
  }

  async process(job: Job<{ campaignId: string; recipientId: string }>): Promise<void> {
    if (job.name !== 'send_message') {
      this.logger.warn(`Skipping unknown job name: ${job.name}`);
      return;
    }

    const { campaignId, recipientId } = job.data;

    await this.knex.transaction(async (trx) => {
      const campaign = await trx('campaigns').where('id', campaignId).first();
      if (!campaign) {
        this.logger.error(`❌ Campaign ${campaignId} not found`);
        return;
      }

      if (campaign.status === 'paused') {
        this.logger.warn(`⏸️ Skipping paused campaign ${campaignId}`);
        return;
      }

      const recipient: ICampaignRecipient | undefined = await trx('campaign_recipient')
        .where('id', recipientId)
        .first();

      if (!recipient) {
        this.logger.error(`❌ Recipient ${recipientId} not found for campaign ${campaignId}`);
        return;
      }

      if (recipient.status !== 'pending') {
        this.logger.warn(
          `ℹ️ Skipping recipient ${recipientId} (status=${recipient.status}) in campaign ${campaignId}`,
        );
        return;
      }

      const templateId: string = recipient.variant_template_id ?? campaign.template_id;
      const user: User | undefined = await trx('users').where('id', recipient.user_id).first();

      if (!user) {
        this.logger.error(`❌ User ${recipient.user_id} not found for recipient ${recipientId}`);
        await this.markAsFailed(trx, campaignId, recipientId, 'User not found');
        return;
      }

      try {
        let messageId: number | undefined;

        if (campaign.delivery_method === 'bot') {
          if (!user.telegram_chat_id) {
            await this.markAsFailed(
              trx,
              campaignId,
              recipientId,
              `No telegram_chat_id for user ${recipient.user_id}`,
            );
            return;
          }

          const template: ITemplate = await trx('templates').where('id', templateId).first();
          if (!template) {
            await this.markAsFailed(
              trx,
              campaignId,
              recipientId,
              `Template ${templateId} not found`,
            );
            return;
          }

          const body = this.renderTemplate(template.body, template.variables, user);

          const res = await this.telegramService.sendMessage(user.telegram_chat_id, body);
          messageId = res.data?.result?.message_id;
        } else if (campaign.delivery_method === 'sms') {
          // 🔜 SMS logikasi
        } else {
          await this.markAsFailed(
            trx,
            campaignId,
            recipientId,
            `Unsupported delivery method: ${campaign.delivery_method}`,
          );
          return;
        }

        await trx('campaign_recipient').where('id', recipientId).update({
          campaign_id: campaignId,
          status: 'sent',
          message_id: messageId,
          sent_at: new Date(),
          updated_at: new Date(),
        });

        this.logger.log(
          `✅ Recipient ${recipientId} in campaign ${campaignId} marked as SENT (messageId=${messageId})`,
        );
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err);

        await this.markAsFailed(trx, campaignId, recipientId, errorMessage);
      }
    });

    await this.checkCampaignCompletion(campaignId);
  }

  private renderTemplate(body: string, variables: string[] | undefined, user: User): string {
    if (!variables || !variables.length) return body;

    let rendered = body;
    for (const key of variables) {
      const value = (user as any)[key] ?? '';
      rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }
    return rendered;
  }

  private async markAsFailed(
    trx: Knex.Transaction,
    campaignId: string,
    recipientId: string,
    error: string,
  ): Promise<void> {
    await trx('campaign_recipient').where('id', recipientId).update({
      campaign_id: campaignId,
      status: 'failed',
      error,
      updated_at: new Date(),
    });
    this.logger.error(
      `❌ Failed job for campaign ${campaignId}, recipient ${recipientId}: ${error}`,
    );
  }

  private async checkCampaignCompletion(campaignId: string): Promise<void> {
    const pendingCount = await this.knex('campaign_recipient')
      .where({ campaign_id: campaignId, status: 'pending' })
      .count('* as count')
      .first();

    if (Number(pendingCount?.count || 0) === 0) {
      await this.knex('campaigns')
        .where('id', campaignId)
        .update({ status: 'completed', updated_at: new Date() });
      this.logger.log(`🎯 Campaign ${campaignId} completed ✅`);
    }
  }
}
