import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import { LoggerService } from 'src/common/logger/logger.service';
import { TelegramService } from 'src/telegram/telegram.service';
// import { SMSService } from 'src/sms/sms.service';
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
    // private readonly smsService: SMSService,
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
      if (campaign.status === 'paused') {
        this.logger.warn(`Skipping paused campaign ${campaignId}`);
        return;
      }

      const recipient: ICampaignRecipient | undefined = await trx('campaign_recipient')
        .where('id', recipientId)
        .first();

      if (!recipient) {
        this.logger.error(`Recipient ${recipientId} not found for campaign ${campaignId}`);
        throw new Error(`Recipient ${recipientId} not found`);
      }

      if (recipient.status !== 'pending') {
        this.logger.warn(`Skipping non-pending recipient ${recipientId}`);
        return;
      }

      const templateId: string = recipient.variant_template_id ?? campaign.template_id;
      const user: User | undefined = await trx('users').where('id', recipient.user_id).first();

      if (!user) {
        this.logger.error(`User ${recipient.user_id} not found for recipient ${recipientId}`);
        throw new Error(`User ${recipient.user_id} not found`);
      }

      try {
        let messageId: number | undefined;
        if (campaign.delivery_method === 'bot') {
          if (!user.telegram_chat_id)
            throw new Error(`No telegram_chat_id for user ${recipient.user_id}`);
          const template: ITemplate = await trx('templates').where('id', templateId).first();
          if (!template) throw new Error(`Template ${templateId} not found`);
          const res = await this.telegramService.sendMessage(user.telegram_chat_id, template.body);
          messageId = res.data?.result?.message_id;
        } else if (campaign.delivery_method === 'sms') {
          // this.smsService.sendSMS(user.phone_number, template.body); // SMS logikasi
          // messageId = ...;
        } else {
          throw new Error(`Unsupported method: ${campaign.delivery_method}`);
        }

        await trx('campaign_recipient').where('id', recipientId).update({
          status: 'sent',
          message_id: messageId,
          sent_at: new Date(),
          updated_at: new Date(),
        });
      } catch (err: any) {
        await trx('campaign_recipient').where('id', recipientId).update({
          status: 'failed',
          error: err.message,
          updated_at: new Date(),
        });
        this.logger.error(`Failed job ${job.id}: ${err.message}`);
        throw err; // Retry uchun
      }
    });

    await this.checkCampaignCompletion(campaignId);
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
      this.logger.log(`Campaign ${campaignId} completed ✅`);
    }
  }
}
