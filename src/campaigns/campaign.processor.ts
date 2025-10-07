import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import { LoggerService } from 'src/common/logger/logger.service';
import { TelegramService } from 'src/telegram/telegram.service';
import { User } from 'src/common/types/user.interface';
import { ITemplate } from 'src/common/types/template.interface';
import { ICampaignRecipient } from 'src/common/types/campaign-recipient.interface';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

function escapeHtml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

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

    const campaign = await this.knex('campaigns').where('id', campaignId).first();
    if (!campaign) {
      this.logger.error(`❌ Campaign ${campaignId} not found`);
      return;
    }
    if (
      campaign.status === 'paused' ||
      campaign.status === 'canceled' ||
      campaign.status === 'failed'
    ) {
      this.logger.warn(`⏸️ Skipping campaign ${campaignId} (status=${campaign.status})`);
      return;
    }

    await this.knex('campaigns')
      .where({ id: campaignId, status: 'queued' })
      .update({ status: 'sending', updated_at: new Date() });

    const claimed: ICampaignRecipient | undefined = await this.knex.transaction(async (trx) => {
      const [row] = await trx('campaign_recipient')
        .where({ id: recipientId, campaign_id: campaignId, status: 'pending' })
        .update({ status: 'processing', updated_at: new Date() })
        .returning('*');
      return row as ICampaignRecipient | undefined;
    });

    if (!claimed) {
      this.logger.warn(`ℹ️ Skip: recipient ${recipientId} not pending or already taken`);
      return;
    }

    const user: User | undefined = await this.knex('users').where('id', claimed.user_id).first();
    if (!user) {
      await this.markAsFailedNoTrx(recipientId, 'User not found');
      await this.checkCampaignCompletionSafe(campaignId);
      return;
    }

    const templateId: string = claimed.variant_template_id ?? campaign.template_id;
    const template: ITemplate | undefined = await this.knex('templates')
      .where('id', templateId)
      .first();
    if (!template) {
      await this.markAsFailedNoTrx(recipientId, `Template ${templateId} not found`);
      await this.checkCampaignCompletionSafe(campaignId);
      return;
    }

    let messageId: number | undefined;
    try {
      if (campaign.delivery_method === 'bot') {
        if (!user.telegram_chat_id) {
          await this.markAsFailedNoTrx(
            recipientId,
            `No telegram_chat_id for user ${claimed.user_id}`,
          );
          await this.checkCampaignCompletionSafe(campaignId);
          return;
        }

        const vars: (keyof User)[] = (template.variables ?? []).filter(
          (k: string): k is keyof User => k in user,
        );

        const body = this.renderTemplate(template.body, vars, user);
        const res = await this.telegramService.sendMessage(user.telegram_chat_id, body);
        messageId = res.data?.result?.message_id;
      } else if (campaign.delivery_method === 'sms') {
        // TODO: SMS provider integration (idempotent guard)
        // messageId = await smsProvider.send(...);
      } else {
        await this.markAsFailedNoTrx(
          recipientId,
          `Unsupported delivery method: ${campaign.delivery_method}`,
        );
        await this.checkCampaignCompletionSafe(campaignId);
        return;
      }
    } catch (err: any) {
      const msg: string = err?.message || 'send failed';
      await this.markAsFailedNoTrx(recipientId, msg);
      await this.checkCampaignCompletionSafe(campaignId);
      return;
    }

    await this.knex('campaign_recipient').where({ id: recipientId }).update({
      status: 'sent',
      message_id: messageId,
      sent_at: new Date(),
      updated_at: new Date(),
    });

    this.logger.log(
      `✅ Recipient ${recipientId} in campaign ${campaignId} marked as SENT (messageId=${messageId})`,
    );

    await this.checkCampaignCompletionSafe(campaignId);
  }

  private renderTemplate(
    body: string,
    variables: ReadonlyArray<keyof User> = [],
    user: User,
  ): string {
    if (!variables?.length) return body;

    let rendered = body;
    for (const key of variables) {
      const raw = user[key];
      const str = raw == null ? '' : String(raw);
      const safe = escapeHtml(str);
      rendered = rendered.replace(new RegExp(`{{${String(key)}}}`, 'g'), safe);
    }
    return rendered;
  }

  private async markAsFailedNoTrx(recipientId: string, error: string): Promise<void> {
    await this.knex('campaign_recipient')
      .where({ id: recipientId })
      .update({ status: 'failed', error, updated_at: new Date() });
    this.logger.error(`❌ Failed job for recipient ${recipientId}: ${error}`);
  }

  private async checkCampaignCompletionSafe(campaignId: string): Promise<void> {
    const row = await this.knex('campaign_recipient')
      .where({ campaign_id: campaignId })
      .whereIn('status', ['pending', 'processing'])
      .count('* as c')
      .first();

    const remaining = Number(row?.c || 0);
    if (remaining === 0) {
      await this.knex('campaigns')
        .where('id', campaignId)
        .update({ status: 'completed', updated_at: new Date() });
      this.logger.log(`🎯 Campaign ${campaignId} completed ✅`);
    } else {
      await this.knex('campaigns')
        .where({ id: campaignId })
        .whereIn('status', ['queued', 'scheduled'])
        .update({ status: 'sending', updated_at: new Date() });
    }
  }
}
