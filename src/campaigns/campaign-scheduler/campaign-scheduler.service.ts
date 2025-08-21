import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Knex } from 'knex';
import axios, { AxiosError } from 'axios';
import { ICampaignRecipient } from 'src/common/types/campaign-recipient.interface';
import { ICampaign } from 'src/common/types/campaign.interface';
import { ITemplate } from 'src/common/types/template.interface';
import { User } from 'src/common/types/user.interface';

const BATCH_SIZE = 100;
const SAFE_MSG_PER_SEC = 10;
const DELAY_MS = 1000 / SAFE_MSG_PER_SEC;

interface AbTestVariant {
  name: string;
  template_id: string;
  percentage: number;
}

interface AbTest {
  enabled: boolean;
  variants: AbTestVariant[];
}

@Injectable()
export class CampaignSchedulerService {
  private readonly logger = new Logger(CampaignSchedulerService.name);

  constructor(private readonly knex: Knex) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleSend(): Promise<void> {
    this.logger.log('🔄 Checking for campaigns to send...');

    const campaigns: ICampaign[] = await this.knex('campaigns')
      .whereIn('status', ['queued', 'scheduled'])
      .andWhere((qb): void => {
        void qb.whereNull('schedule_at').orWhere('schedule_at', '<=', new Date());
      })
      .limit(3);

    for (const campaign of campaigns) {
      await this.processCampaign(campaign);
    }
  }

  private async processCampaign(campaign: ICampaign): Promise<void> {
    this.logger.log(`🚀 Processing campaign ${campaign.id}`);

    const recipients: ICampaignRecipient[] = await this.knex('campaign_recipient')
      .where('campaign_id', campaign.id)
      .whereIn('status', ['queued', 'failed'])
      .limit(BATCH_SIZE);

    if (!recipients.length) {
      await this.knex('campaigns')
        .where('id', campaign.id)
        .update({ status: 'completed', updated_at: new Date() });
      this.logger.log(`✅ Campaign ${campaign.id} completed`);
      return;
    }

    for (const r of recipients) {
      try {
        const chatId: string | null = await this.getUserChatId(r.user_id);
        if (!chatId) {
          await this.markFailed(r.id, 'No Telegram chat ID');
          continue;
        }

        const templateText: string = await this.getTemplateText(campaign);

        const res = await axios.post(
          `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
          { chat_id: chatId, text: templateText },
        );

        if (res.data.ok) {
          await this.knex('campaign_recipient').where('id', r.id).update({
            status: 'delivered',
            message_id: res.data.result.message_id,
            sent_at: new Date(),
            updated_at: new Date(),
          });
        } else {
          await this.markFailed(r.id, JSON.stringify(res.data));
        }
      } catch (error) {
        const err = error as AxiosError<any>;

        if (err.response?.status === 429) {
          const retryAfter = err.response.data?.parameters?.retry_after || 5;
          this.logger.warn(`⚠️ FloodWait: sleeping ${retryAfter}s`);
          await new Promise((res) => setTimeout(res, retryAfter * 1000));
        }

        const errorMessage: string =
          err.response?.data?.description || err.message || 'Unknown error';

        await this.markFailed(r.id, errorMessage);
      }

      await new Promise((res) => setTimeout(res, DELAY_MS));
    }
  }

  private async markFailed(recipientId: string, error: string): Promise<void> {
    await this.knex('campaign_recipient').where('id', recipientId).update({
      status: 'failed',
      error,
      updated_at: new Date(),
    });
  }

  private async getUserChatId(userId: string): Promise<string | null> {
    const user: User = await this.knex('users')
      .select('telegram_chat_id')
      .where('id', userId)
      .first();
    return user?.telegram_chat_id || null;
  }

  private async getTemplateText(campaign: ICampaign): Promise<string> {
    const ab: AbTest | null = campaign?.ab_test;
    let templateId = campaign.template_id;

    if (ab?.enabled && ab.variants?.length) {
      const rnd = Math.random() * 100;
      let acc = 0;
      for (const v of ab.variants) {
        acc += v.percentage;
        if (rnd <= acc) {
          templateId = v.template_id;
          break;
        }
      }
    }

    const t: ITemplate | undefined = await this.knex('templates').where('id', templateId).first();
    return t?.body || 'No template content';
  }
}
