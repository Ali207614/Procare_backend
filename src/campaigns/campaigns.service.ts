import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Knex } from 'knex';
import { InjectKnex } from 'nestjs-knex';
import { ICampaign } from 'src/common/types/campaign.interface';
import {
  CreateCampaignDto,
  UsersFilterDto,
  AbTestConfigDto,
  AbTestVariantDto,
} from 'src/campaigns/dto/create-campaign.dto';
import { FindAllCampaignsDto } from 'src/campaigns/dto/find-all-campaigns.dto';
import { UpdateCampaignDto } from 'src/campaigns/dto/update-campaign.dto';
import { ITemplate } from 'src/common/types/template.interface';
import { User } from 'src/common/types/user.interface';
import { LoggerService } from 'src/common/logger/logger.service';

interface AbTestInput {
  template_id: string;
  ab_test?: AbTestConfigDto;
}

@Injectable()
export class CampaignsService {
  constructor(
    @InjectQueue('campaigns') private readonly queue: Queue,
    @InjectKnex() private readonly knex: Knex,
    private readonly logger: LoggerService,
  ) {}

  async create(dto: CreateCampaignDto): Promise<ICampaign> {
    return this.knex.transaction(async (trx) => {
      const template = await trx('templates')
        .where({ id: dto.template_id, status: 'active' })
        .first();
      if (!template) {
        throw new NotFoundException({
          message: 'Template not found or inactive',
          location: 'template_id',
        });
      }

      let status: ICampaign['status'] = 'queued';
      if (dto.send_type === 'schedule') {
        if (!dto.schedule_at) {
          throw new BadRequestException({
            message: 'Schedule time required',
            location: 'schedule_at',
          });
        }
        const scheduleDate = new Date(dto.schedule_at);
        if (scheduleDate <= new Date()) {
          throw new BadRequestException({
            message: 'Schedule must be in the future',
            location: 'schedule_at',
          });
        }
        status = 'scheduled';
      }

      const abTest = await this.prepareAbTest(trx, dto);

      const [campaign]: ICampaign[] = await trx('campaigns')
        .insert({
          template_id: dto.template_id,
          filters: dto.filters ? JSON.stringify(dto.filters) : '{}',
          send_type: dto.send_type,
          schedule_at: dto.schedule_at ? new Date(dto.schedule_at) : null,
          ab_test: JSON.stringify(abTest),
          delivery_method: dto.delivery_method,
          status,
          created_at: trx.fn.now(),
          updated_at: trx.fn.now(),
        })
        .returning('*');

      const recipientIds = await this.insertRecipients(trx, campaign.id, dto.filters, abTest);

      await this.enqueueRecipients(campaign.id, recipientIds);
      return campaign;
    });
  }

  async update(id: string, dto: UpdateCampaignDto): Promise<ICampaign> {
    return this.knex.transaction(async (trx) => {
      const campaign: ICampaign | undefined = await trx('campaigns').where('id', id).first();
      if (!campaign) {
        throw new NotFoundException({
          message: 'Campaign not found',
          location: 'campaign',
          id,
        });
      }

      if (!['queued', 'scheduled'].includes(campaign.status)) {
        throw new BadRequestException('Cannot update running, completed, or canceled campaign');
      }

      const newTemplateId = dto.template_id || campaign.template_id;
      const template = await trx('templates')
        .where({ id: newTemplateId, status: 'active' })
        .first();
      if (!template) {
        throw new NotFoundException({
          message: 'Template not found or inactive',
          location: 'template_id',
        });
      }

      const newSendType = dto.send_type || campaign.send_type;
      const newScheduleAt = dto.schedule_at ? new Date(dto.schedule_at) : campaign.schedule_at;
      let newStatus: string = dto.status || campaign.status;

      if (newSendType === 'schedule') {
        if (!newScheduleAt) {
          throw new BadRequestException({
            message: 'Schedule time is required',
            location: 'schedule_at',
          });
        }
        if (newScheduleAt <= new Date()) {
          throw new BadRequestException({
            message: 'Schedule must be in the future',
            location: 'schedule_at',
          });
        }
        if (!['paused', 'canceled'].includes(newStatus)) newStatus = 'scheduled';
      } else if (newSendType === 'now') {
        if (!['paused', 'canceled'].includes(newStatus)) newStatus = 'queued';
      } else {
        throw new BadRequestException({
          message: 'Invalid send type',
          location: 'send_type',
        });
      }

      const [updated]: ICampaign[] = await trx('campaigns')
        .where('id', id)
        .update({
          template_id: newTemplateId,
          send_type: newSendType,
          schedule_at: newScheduleAt,
          status: newStatus,
          updated_at: trx.fn.now(),
        })
        .returning('*');

      // Agar status 'queued' yoki 'scheduled' bo'lsa, qayta enqueue qilish mumkin, lekin hozircha kerak emas

      return updated;
    });
  }

  async findAll(filters: FindAllCampaignsDto): Promise<ICampaign[]> {
    const qb = this.knex('campaigns')
      .leftJoin('templates', 'campaigns.template_id', 'templates.id')
      .select(
        'campaigns.*',
        'templates.name as template_name',
        'templates.description as template_description',
      );

    if (filters.status) void qb.where('campaigns.status', filters.status);
    if (filters.search) {
      void qb.where(function () {
        void this.where('campaigns.template_id', 'like', `%${filters.search}%`)
          .orWhereILike('templates.name', `%${filters.search}%`)
          .orWhereILike('templates.description', `%${filters.search}%`);
      });
    }

    return qb.limit(filters.limit).offset(filters.offset);
  }

  async findOne(id: string): Promise<ICampaign> {
    const campaign: ICampaign | undefined = await this.knex('campaigns').where('id', id).first();
    if (!campaign) {
      throw new NotFoundException({
        message: 'Campaign not found',
        location: 'campaign',
        id,
      });
    }
    return campaign;
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.knex('campaigns').where('id', id).del();
    if (!deleted) {
      throw new NotFoundException({
        message: 'Campaign not found',
        location: 'campaign',
        id,
      });
    }
  }

  private async prepareAbTest(trx: Knex.Transaction, dto: AbTestInput): Promise<AbTestConfigDto> {
    if (!dto.ab_test?.enabled) return { enabled: false, variants: [] };

    const variants: AbTestVariantDto[] = dto.ab_test.variants || [];
    if (variants.length < 1) {
      throw new BadRequestException({
        message: 'At least 1 variant is required when A/B test is enabled',
        location: 'ab_test.variants',
      });
    }

    const total: number = variants.reduce((s, v) => s + Number(v.percentage || 0), 0);
    if (total > 100) {
      throw new BadRequestException({
        message: 'A/B test percentages cannot exceed 100',
        location: 'ab_test.variants.percentage',
      });
    }

    const ids: string[] = variants.map((v) => v.template_id);
    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) {
      throw new BadRequestException({
        message: 'Duplicate template_id detected in A/B variants',
        location: 'ab_test.variants.template_id',
      });
    }

    const activeTemplates: ITemplate[] = await trx('templates')
      .whereIn('id', ids)
      .andWhere('status', 'active');

    if (activeTemplates.length !== ids.length) {
      throw new BadRequestException({
        message: 'One or more A/B test templates not found or inactive',
        location: 'ab_test.variants.template_id',
      });
    }

    if (total < 100) {
      variants.push({
        name: 'Default',
        template_id: dto.template_id,
        percentage: 100 - total,
      });
    }

    return {
      enabled: true,
      variants: variants.map((v) => ({
        name: v.name,
        template_id: v.template_id,
        percentage: Number(v.percentage),
      })),
    };
  }

  private async insertRecipients(
    trx: Knex.Transaction,
    campaignId: string,
    filters: UsersFilterDto = {},
    abTest: AbTestConfigDto,
  ): Promise<{ id: string }[]> {
    let query = trx('users').select('id');

    // Sana filterlari
    if (filters.created_from && filters.created_to) {
      query = query.whereBetween('created_at', [
        new Date(filters.created_from),
        new Date(filters.created_to),
      ]);
    } else if (filters.created_from) {
      query = query.where('created_at', '>=', new Date(filters.created_from));
    } else if (filters.created_to) {
      query = query.where('created_at', '<=', new Date(filters.created_to));
    }

    const allowedFilters: (keyof UsersFilterDto)[] = [
      'first_name',
      'last_name',
      'phone_number',
      'passport_series',
      'id_card_number',
      'telegram_username',
      'is_active',
    ];

    for (const [key, rawValue] of Object.entries(filters)) {
      if (rawValue === undefined) continue;
      if (!allowedFilters.includes(key as keyof UsersFilterDto)) continue;

      const value = rawValue as unknown;

      if (
        typeof value === 'string' &&
        [
          'first_name',
          'last_name',
          'phone_number',
          'passport_series',
          'id_card_number',
          'telegram_username',
        ].includes(key)
      ) {
        query = query.whereILike(key, `%${value}%`);
      } else if (
        typeof value === 'boolean' ||
        typeof value === 'number' ||
        typeof value === 'string'
      ) {
        query = query.where(key, value);
      }
    }

    const users: User[] = await query;
    if (!users.length) return [];

    const now = new Date();
    let recipients: any[] = [];

    if (abTest.enabled && abTest.variants.length) {
      const shuffled: User[] = users.sort(() => Math.random() - 0.5);
      let start = 0;
      for (const variant of abTest.variants) {
        const count = Math.floor((shuffled.length * variant.percentage) / 100);
        const chunk = shuffled.slice(start, start + count);
        start += count;
        recipients.push(
          ...chunk.map((u) => ({
            campaign_id: campaignId,
            user_id: u.id,
            status: 'pending',
            variant_template_id: variant.template_id,
            created_at: now,
            updated_at: now,
          })),
        );
      }
    } else {
      recipients = users.map((u) => ({
        campaign_id: campaignId,
        user_id: u.id,
        status: 'pending',
        created_at: now,
        updated_at: now,
      }));
    }

    const batchSize = 1000;
    const insertedIds: { id: string }[] = [];
    for (let i = 0; i < recipients.length; i += batchSize) {
      const chunk = recipients.slice(i, i + batchSize);
      const ids: { id: string }[] = await trx('campaign_recipient').insert(chunk).returning('id');
      insertedIds.push(...ids);
    }

    return insertedIds;
  }

  private async enqueueRecipients(
    campaignId: string,
    recipientIds?: { id: string }[],
  ): Promise<void> {
    const campaign: ICampaign | undefined = await this.knex('campaigns')
      .where('id', campaignId)
      .first();
    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }

    let delay = 0;
    if (campaign.send_type === 'schedule' && campaign.schedule_at) {
      const scheduleTime = new Date(campaign.schedule_at).getTime();
      delay = scheduleTime - Date.now();
      if (delay < 0) delay = 0; // agar o‘tib ketgan bo‘lsa darhol ishga tushadi
    }

    const jobs = (recipientIds ?? []).map((r) => ({
      name: 'send_message',
      data: { campaignId, recipientId: r.id },
      opts: { delay, attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
    }));

    if (jobs.length) {
      await this.queue.addBulk(jobs);
      this.logger.log(
        `Enqueued ${jobs.length} jobs for campaign ${campaignId} with delay ${delay}ms`,
      );
    }
  }

  async pauseCampaign(campaignId: string): Promise<void> {
    await this.knex('campaigns').where('id', campaignId).update({ status: 'paused' });

    const jobs = await this.queue.getJobs(['waiting', 'delayed', 'active']);
    for (const job of jobs) {
      if (job.data.campaignId === campaignId) {
        await job.remove();
      }
    }

    this.logger.log(`Paused campaign ${campaignId} and removed pending jobs`);
  }

  async resumeCampaign(campaignId: string): Promise<void> {
    await this.knex('campaigns').where('id', campaignId).update({ status: 'sending' });
    await this.enqueueRecipients(campaignId);
    this.logger.log(`Resumed campaign ${campaignId}`);
  }
}
