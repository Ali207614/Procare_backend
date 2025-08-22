import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
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

@Injectable()
export class CampaignsService {
  constructor(
    @InjectKnex() private readonly knex: Knex,
    @InjectQueue('campaign-queue') private readonly campaignQueue: Queue,
    private readonly logger: LoggerService,
  ) {}

  async create(createCampaignDto: CreateCampaignDto): Promise<ICampaign> {
    return this.knex.transaction(async (trx) => {
      const template = await trx('templates')
        .where('id', createCampaignDto.template_id)
        .where('status', 'active')
        .first();

      if (!template) {
        throw new NotFoundException({
          message: 'Template not found or inactive',
          location: 'template_id',
        });
      }

      let status: 'queued' | 'scheduled' = 'queued';
      if (createCampaignDto.send_type === 'schedule') {
        if (!createCampaignDto.schedule_at) {
          throw new BadRequestException({
            message: 'Schedule time is required for scheduled campaigns',
            location: 'schedule_at',
          });
        }
        const scheduleDate = new Date(createCampaignDto.schedule_at);
        if (scheduleDate <= new Date()) {
          throw new BadRequestException({
            message: 'Schedule time must be in the future',
            location: 'schedule_at',
          });
        }
        status = 'scheduled';
      }

      let abTestToSave: AbTestConfigDto = { enabled: false, variants: [] };
      if (createCampaignDto.ab_test?.enabled) {
        const variants: AbTestVariantDto[] = createCampaignDto?.ab_test?.variants || [];
        if (variants.length < 1) {
          throw new BadRequestException({
            message: 'At least 1 variant is required when A/B test is enabled',
            location: 'ab_test.variants',
          });
        }
        const total = variants.reduce((s, v) => s + Number(v.percentage || 0), 0);
        if (total > 100) {
          throw new BadRequestException({
            message: 'A/B test percentages cannot exceed 100',
            location: 'ab_test.variants.percentage',
          });
        }
        const ids: string[] = variants.map((v: AbTestVariantDto): string => v.template_id);
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
            template_id: createCampaignDto.template_id,
            percentage: 100 - total,
          });
        }
        abTestToSave = {
          enabled: true,
          variants: variants.map((v) => ({
            name: v.name,
            template_id: v.template_id,
            percentage: Number(v.percentage),
          })),
        };
      }

      const [campaign]: ICampaign[] = await trx('campaigns')
        .insert({
          template_id: createCampaignDto.template_id,
          filters: createCampaignDto.filters ? JSON.stringify(createCampaignDto.filters) : '{}',
          send_type: createCampaignDto.send_type,
          schedule_at: createCampaignDto.schedule_at
            ? new Date(createCampaignDto.schedule_at)
            : null,
          ab_test: JSON.stringify(abTestToSave),
          delivery_method: createCampaignDto.delivery_method,
          status,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('*');

      if (createCampaignDto.filters && Object.keys(createCampaignDto.filters).length > 0) {
        let query = trx('users').select('id', 'telegram_chat_id');
        const filters = createCampaignDto.filters ?? {};
        (
          Object.entries(filters) as [keyof UsersFilterDto, string | boolean | number | undefined][]
        ).forEach(([key, value]) => {
          if (value === undefined) return;

          if (key === 'created_from' && filters.created_to) {
            if (filters.created_to === 'string') {
              query = query.whereBetween('created_at', [
                new Date(value as string),
                new Date(filters.created_to),
              ]);
            }
          } else if (key === 'created_from' && typeof value === 'string') {
            query = query.where('created_at', '>=', new Date(value));
          } else if (key === 'created_to' && typeof value === 'string') {
            query = query.where('created_at', '<=', new Date(value));
          } else if (
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
          } else {
            query = query.where(key, value);
          }
        });

        const users: User[] = await query;
        if (users.length > 0) {
          const now = new Date();
          const recipients = users.map((u) => ({
            campaign_id: campaign.id,
            user_id: u.id,
            status: status === 'scheduled' ? 'pending' : 'sent',
            created_at: now,
            updated_at: now,
          }));
          const batchSize = 1000;
          for (let i = 0; i < recipients.length; i += batchSize) {
            await trx('campaign_recipient').insert(recipients.slice(i, i + batchSize));
          }

          let job;
          if (status === 'queued') {
            job = await this.campaignQueue.add(
              'send-campaign',
              { campaignId: campaign.id },
              { attempts: 3, backoff: 1000 },
            );
          } else if (status === 'scheduled') {
            const delay = createCampaignDto.schedule_at
              ? new Date(createCampaignDto.schedule_at).getTime() - Date.now()
              : 0;
            if (delay < 0) {
              throw new BadRequestException({
                message: 'Schedule time must be in the future',
                location: 'schedule_at',
              });
            }
            job = await this.campaignQueue.add(
              'send-campaign',
              { campaignId: campaign.id },
              { delay, attempts: 3, backoff: 1000 },
            );
          }
          if (job) {
            const jobIdStr = job.id.toString();
            await trx('campaigns').where('id', campaign.id).update({ job_id: jobIdStr });
            campaign.job_id = jobIdStr;
          }
        }
      }

      return campaign;
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
      const search = filters.search;
      void qb.where(function () {
        void this.where('campaigns.template_id', 'like', `%${search}%`)
          .orWhereILike('templates.name', `%${search}%`)
          .orWhereILike('templates.description', `%${search}%`);
      });
    }

    return qb.limit(filters.limit).offset(filters.offset);
  }

  async findOne(id: string): Promise<ICampaign> {
    const campaign: ICampaign | undefined = await this.knex('campaigns').where('id', id).first();
    if (!campaign) {
      throw new NotFoundException({ message: 'Campaign not found', location: 'campaign', id });
    }
    return campaign;
  }

  async update(id: string, updateCampaignDto: UpdateCampaignDto): Promise<ICampaign> {
    return this.knex.transaction(async (trx) => {
      const campaign: ICampaign = await this.findOne(id);
      if (!['queued', 'scheduled', 'paused'].includes(campaign.status)) {
        throw new BadRequestException('Cannot update running, completed, or canceled campaign');
      }

      const newTemplateId = updateCampaignDto.template_id || campaign.template_id;
      const template = await trx('templates')
        .where('id', newTemplateId)
        .where('status', 'active')
        .first();
      if (!template)
        throw new NotFoundException({
          message: 'Template not found or inactive',
          location: 'template_id',
        });

      const newSendType = updateCampaignDto.send_type || campaign.send_type;
      const newScheduleAt = updateCampaignDto.schedule_at
        ? new Date(updateCampaignDto.schedule_at)
        : campaign.schedule_at;
      let newStatus = updateCampaignDto.status || campaign.status;
      const newFilters = updateCampaignDto.filters || campaign.filters;
      const newAbTest = updateCampaignDto.ab_test || campaign.ab_test;

      if (newStatus === 'paused' && campaign.job_id) {
        const job = await this.campaignQueue.getJob(campaign.job_id);
        if (job) {
          await job.remove();
          await trx('campaigns').where('id', id).update({ job_id: null });
          this.logger.log(`Paused (removed) job ${campaign.job_id} for campaign ${id}`);
        }
      } else if (newStatus === 'canceled' && campaign.job_id) {
        const job = await this.campaignQueue.getJob(campaign.job_id);
        if (job) {
          await job.remove();
          this.logger.log(`Canceled job ${campaign.job_id} for campaign ${id}`);
        }
        await trx('campaign_recipient').where('campaign_id', id).update({ status: 'canceled' });
        await trx('campaigns').where('id', id).update({ job_id: null });
      }

      if (newSendType === 'schedule') {
        if (!newScheduleAt)
          throw new BadRequestException({
            message: 'Schedule time is required',
            location: 'schedule_at',
          });
        if (newScheduleAt <= new Date())
          throw new BadRequestException({
            message: 'Schedule time must be in the future',
            location: 'schedule_at',
          });
        if (newStatus !== 'paused' && newStatus !== 'canceled') newStatus = 'scheduled';
      } else if (newSendType === 'now') {
        if (newStatus !== 'paused' && newStatus !== 'canceled') newStatus = 'queued';
      } else {
        throw new BadRequestException({ message: 'Invalid send type', location: 'send_type' });
      }

      const [updatedCampaign]: ICampaign[] = await trx('campaigns')
        .where('id', id)
        .update({
          template_id: newTemplateId,
          send_type: newSendType,
          schedule_at: newScheduleAt,
          status: newStatus,
          filters: newFilters ? JSON.stringify(newFilters) : campaign.filters,
          ab_test: newAbTest ? JSON.stringify(newAbTest) : campaign.ab_test,
          updated_at: new Date(),
        })
        .returning('*');

      if (updateCampaignDto.filters) {
        await trx('campaign_recipient').where('campaign_id', id).del();
        const query = trx('users').select('id', 'telegram_chat_id');
        const users: User[] = await query;
        if (users.length > 0) {
          const now = new Date();
          const recipients = users.map((u) => ({
            campaign_id: id,
            user_id: u.id,
            status: newStatus === 'scheduled' ? 'pending' : 'sent',
            created_at: now,
            updated_at: now,
          }));
          const batchSize = 1000;
          for (let i = 0; i < recipients.length; i += batchSize) {
            await trx('campaign_recipient').insert(recipients.slice(i, i + batchSize));
          }
          let job;
          if (newStatus === 'queued') {
            job = await this.campaignQueue.add(
              'send-campaign',
              { campaignId: id },
              { attempts: 3, backoff: 1000 },
            );
          } else if (newStatus === 'scheduled') {
            const delay = newScheduleAt ? newScheduleAt.getTime() - Date.now() : 0;
            if (delay < 0) {
              throw new BadRequestException({
                message: 'Schedule time must be in the future',
                location: 'schedule_at',
              });
            }
            job = await this.campaignQueue.add(
              'send-campaign',
              { campaignId: id },
              { delay, attempts: 3, backoff: 1000 },
            );
          }
          if (job) {
            const jobIdStr = job.id.toString();
            await trx('campaigns').where('id', id).update({ job_id: job.id });
            updatedCampaign.job_id = jobIdStr;
          }
        }
      }

      if (campaign.status === 'paused' && ['queued', 'scheduled'].includes(newStatus)) {
        let job;
        if (newStatus === 'queued') {
          job = await this.campaignQueue.add(
            'send-campaign',
            { campaignId: id },
            { attempts: 3, backoff: 1000 },
          );
        } else if (newStatus === 'scheduled') {
          const delay = newScheduleAt ? newScheduleAt.getTime() - Date.now() : 0;
          if (delay < 0)
            throw new BadRequestException({
              message: 'Schedule time must be in the future',
              location: 'schedule_at',
            });
          job = await this.campaignQueue.add(
            'send-campaign',
            { campaignId: id },
            { delay, attempts: 3, backoff: 1000 },
          );
        }
        if (job) {
          await trx('campaigns').where('id', id).update({ job_id: job.id.toString() }); // Tip moslash
          updatedCampaign.job_id = job.id.toString();
          this.logger.log(`Resumed by adding new job ${job.id} for campaign ${id}`);
        }
      }

      return updatedCampaign;
    });
  }
  async remove(id: string): Promise<void> {
    const deleted = await this.knex('campaigns').where('id', id).del();
    if (!deleted) {
      throw new NotFoundException({ message: 'Campaign not found', location: 'campaign', id });
    }
  }
}
