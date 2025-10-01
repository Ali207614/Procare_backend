import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Knex } from 'knex';
import { InjectKnex } from 'nestjs-knex';
import { ICampaign } from 'src/common/types/campaign.interface';
import {
  CreateCampaignDto,
  AbTestConfigDto,
  AbTestVariantDto,
} from 'src/campaigns/dto/create-campaign.dto';
import { FindAllCampaignsDto } from 'src/campaigns/dto/find-all-campaigns.dto';
import { UpdateCampaignDto } from 'src/campaigns/dto/update-campaign.dto';
import { ITemplate } from 'src/common/types/template.interface';
import { User } from 'src/common/types/user.interface';
import { LoggerService } from 'src/common/logger/logger.service';
import { PaginationResult } from 'src/common/utils/pagination.util';
import { ICampaignRecipient } from 'src/common/types/campaign-recipient.interface';
import { FindAllRecipientsDto } from 'src/campaigns/dto/find-all-recipients.dto';
import { FindAllUsersDto } from 'src/users/dto/find-all-user.dto';
import { UsersService } from 'src/users/users.service';

interface AbTestInput {
  template_id: string;
  ab_test?: AbTestConfigDto;
}

@Injectable()
export class CampaignsService {
  constructor(
    @Inject('CAMPAIGNS_QUEUE') private readonly queue: Queue,
    @InjectKnex() private readonly knex: Knex,
    private readonly userService: UsersService,
    private readonly logger: LoggerService,
  ) {}

  async create(dto: CreateCampaignDto): Promise<ICampaign> {
    return this.knex
      .transaction(async (trx) => {
        const template = await trx<ITemplate>('templates')
          .where({ id: dto.template_id, status: 'Open' })
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

        const abTest: AbTestConfigDto = await this.prepareAbTest(trx, dto);

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

        const recipientIds: { id: string }[] = await this.insertRecipients(
          trx,
          campaign.id,
          dto.filters,
          abTest,
        );

        return { campaign, recipientIds };
      })
      .then(async ({ campaign, recipientIds }) => {
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

  async findAll(filters: FindAllCampaignsDto): Promise<PaginationResult<ICampaign>> {
    const baseQuery = this.knex('campaigns as c')
      .select(
        'c.id',
        'c.template_id',
        'c.filters',
        'c.send_type',
        'c.schedule_at',
        'c.ab_test',
        'c.delivery_method',
        'c.status',
        'c.job_id',
        'c.created_at',
        'c.updated_at',
        this.knex.raw(`
        json_build_object(
          'id', t.id,
          'title', t.title,
          'language', t.language,
          'body', t.body,
          'variables', t.variables,
          'status', t.status,
          'created_by', t.created_by,
          'used_count', t.used_count,
          'created_at', t.created_at,
          'updated_at', t.updated_at
        ) as template
      `),
      )
      .leftJoin('templates as t', 'c.template_id', 't.id')
      .modify((qb) => {
        if (filters.status) void qb.where('c.status', filters.status);
        if (filters.send_type) void qb.where('c.send_type', filters.send_type);
        if (filters.delivery_method) void qb.where('c.delivery_method', filters.delivery_method);
        if (filters.template_id) void qb.where('c.template_id', filters.template_id);

        if (filters.schedule_from) void qb.where('c.schedule_at', '>=', filters.schedule_from);
        if (filters.schedule_to) void qb.where('c.schedule_at', '<=', filters.schedule_to);

        if (filters.search) {
          void qb.where(function () {
            void this.whereILike('t.title', `%${filters.search}%`).orWhereILike(
              't.body',
              `%${filters.search}%`,
            );
          });
        }
      });

    const [{ count }] = await baseQuery
      .clone()
      .clearSelect()
      .count<{ count: string }[]>('* as count');
    const rows = await baseQuery
      .orderBy('c.created_at', 'desc')
      .limit(filters.limit)
      .offset(filters.offset);

    return {
      total: Number(count),
      limit: filters.limit,
      offset: filters.offset,
      rows: rows as ICampaign[],
    };
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

  async findRecipients(
    campaignId: string,
    filters: FindAllRecipientsDto,
  ): Promise<PaginationResult<ICampaignRecipient>> {
    const baseQuery = this.knex('campaign_recipient as cr')
      .select(
        'cr.id',
        'cr.campaign_id', // 🔑 qo‘shildi
        'cr.user_id', // 🔑 qo‘shildi
        'cr.variant_template_id', // 🔑 qo‘shildi
        'cr.status',
        'cr.message_id',
        'cr.sent_at',
        'cr.delivered_at',
        'cr.read_at',
        'cr.error',
        'cr.created_at',
        'cr.updated_at',
        this.knex.raw(`
        json_build_object(
          'id', u.id,
          'first_name', u.first_name,
          'last_name', u.last_name,
          'phone_number1', u.phone_number1,
          'phone_number2', u.phone_number2,
          'passport_series', u.passport_series,
          'id_card_number', u.id_card_number,
          'telegram_username', u.telegram_username,
          'telegram_chat_id', u.telegram_chat_id,
          'is_active', u.is_active
        ) as user
      `),
      )
      .leftJoin('users as u', 'cr.user_id', 'u.id')
      .where('cr.campaign_id', campaignId);

    if (filters.status) {
      if (filters.status === 'success') {
        void baseQuery.whereIn('cr.status', ['sent', 'delivered', 'read']);
      } else if (filters.status === 'error') {
        void baseQuery.whereIn('cr.status', ['failed', 'blocked', 'unsubscribed']);
      } else {
        void baseQuery.where('cr.status', filters.status);
      }
    }

    if (filters.search) {
      const s = `%${filters.search.toLowerCase()}%`;
      void baseQuery.andWhere((qb) => {
        void qb
          .whereRaw('LOWER(u.first_name) LIKE ?', [s])
          .orWhereRaw('LOWER(u.last_name) LIKE ?', [s])
          .orWhereRaw('LOWER(u.phone_number1) LIKE ?', [s])
          .orWhereRaw('LOWER(u.phone_number2) LIKE ?', [s])
          .orWhereRaw('LOWER(u.passport_series) LIKE ?', [s])
          .orWhereRaw('LOWER(u.id_card_number) LIKE ?', [s])
          .orWhereRaw('LOWER(u.telegram_username) LIKE ?', [s]);
      });
    }

    if (filters.sort_by) {
      void baseQuery.orderBy(`cr.${filters.sort_by}`, filters.sort_order || 'desc');
    } else {
      void baseQuery.orderBy('cr.created_at', 'desc');
    }

    const [{ count }] = await baseQuery
      .clone()
      .clearSelect()
      .clearOrder()
      .count<{ count: string }[]>('* as count');

    const rows = await baseQuery.limit(filters.limit).offset(filters.offset);

    return {
      total: Number(count),
      limit: filters.limit,
      offset: filters.offset,
      rows: rows as ICampaignRecipient[],
    };
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
    if (!dto.ab_test?.enabled) {
      return { enabled: false, variants: [] };
    }

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

    const activeTemplates: ITemplate[] = await trx<ITemplate>('templates')
      .whereIn('id', ids)
      .andWhere('status', 'Open');

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
    filters: FindAllUsersDto = {},
    abTest: AbTestConfigDto,
  ): Promise<{ id: string }[]> {
    const users: User[] = await this.userService.buildUserQuery(trx, filters).select('id');

    if (!users.length) return [];

    const now = new Date();
    let recipients: any[] = [];

    if (abTest.enabled && abTest.variants.length) {
      const shuffled = users.sort(() => Math.random() - 0.5);
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
      throw new NotFoundException({
        message: 'Campaign not found',
        location: 'campaign',
      });
    }

    let delay = 0;
    if (campaign.send_type === 'schedule' && campaign.schedule_at) {
      const scheduleTime = new Date(campaign.schedule_at).getTime();
      delay = scheduleTime - Date.now();
      if (delay < 0) delay = 0;
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
