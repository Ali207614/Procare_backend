import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Knex } from 'knex';

import { InjectKnex } from 'nestjs-knex';
import { ICampaign } from 'src/common/types/campaign.interface';
import { CreateCampaignDto, UsersFilterDto } from 'src/campaigns/dto/create-campaign.dto';
import { FindAllCampaignsDto } from 'src/campaigns/dto/find-all-campaigns.dto';
import { UpdateCampaignDto } from 'src/campaigns/dto/update-campaign.dto';

@Injectable()
export class CampaignsService {
  constructor(@InjectKnex() private readonly knex: Knex) {}

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
      if (createCampaignDto.send_type === 'now') {
        status = 'queued';
      } else if (createCampaignDto.send_type === 'schedule') {
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
      } else {
        throw new BadRequestException({
          message: 'Invalid send type',
          location: 'send_type',
        });
      }

      const [campaign]: ICampaign[] = await trx('campaigns')
        .insert({
          template_id: createCampaignDto.template_id,
          filters: createCampaignDto.filters ? JSON.stringify(createCampaignDto.filters) : '{}',
          send_type: createCampaignDto.send_type,
          schedule_at: createCampaignDto.schedule_at
            ? new Date(createCampaignDto.schedule_at)
            : null,
          status,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('*');

      if (createCampaignDto.filters && Object.keys(createCampaignDto.filters).length > 0) {
        let query = trx('users').select('id as user_id');
        (
          Object.entries(createCampaignDto.filters) as Array<
            [keyof UsersFilterDto, UsersFilterDto[keyof UsersFilterDto]]
          >
        ).forEach(([key, value]) => {
          if (key === 'created_from' && value) {
            query = query.where('created_at', '>=', new Date(value as string));
          } else if (key === 'created_to' && value) {
            query = query.where('created_at', '<=', new Date(value as string));
          } else if (value !== undefined) {
            query = query.where(key, value);
          }
        });
        const users = await query;

        if (users.length > 0) {
          const recipients = users.map((user) => ({
            campaign_id: campaign.id,
            user_id: user.user_id,
            status: 'sent',
            created_at: new Date(),
            updated_at: new Date(),
          }));
          await trx('campaign_recipient').insert(recipients);
        }
      }

      return campaign;
    });
  }
  async findAll(filters: FindAllCampaignsDto): Promise<ICampaign[]> {
    return this.knex('campaigns')
      .select('*')
      .modify((qb) => {
        if (filters.status) void qb.where('status', filters.status);
        if (filters.search)
          void qb.whereRaw('LOWER(template_id) LIKE ?', [`%${filters.search.toLowerCase()}%`]);
      })
      .limit(filters.limit)
      .offset(filters.offset);
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

  async update(id: string, updateCampaignDto: UpdateCampaignDto): Promise<ICampaign> {
    return this.knex.transaction(async (trx) => {
      const campaign: ICampaign = await this.findOne(id);

      const newTemplateId = updateCampaignDto.template_id || campaign.template_id;
      const template = await trx('templates')
        .where('id', newTemplateId)
        .where('status', 'active')
        .first();
      if (!template) {
        throw new NotFoundException({
          message: 'Template not found or inactive',
          location: 'template_id',
        });
      }

      const newSendType = updateCampaignDto.send_type || campaign.send_type;
      const newScheduleAt = updateCampaignDto.schedule_at
        ? new Date(updateCampaignDto.schedule_at)
        : campaign.schedule_at;
      let newStatus = updateCampaignDto.status || campaign.status;

      if (newSendType === 'schedule') {
        if (!newScheduleAt) {
          throw new BadRequestException({
            message: 'Schedule time is required for scheduled campaigns',
            location: 'schedule_at',
          });
        }
        if (newScheduleAt <= new Date()) {
          throw new BadRequestException({
            message: 'Schedule time must be in the future',
            location: 'schedule_at',
          });
        }
        newStatus = 'scheduled';
      } else if (newSendType === 'now') {
        newStatus = 'queued';
      } else {
        throw new BadRequestException({
          message: 'Invalid send type',
          location: 'send_type',
        });
      }

      const [updatedCampaign]: ICampaign[] = await trx('campaigns')
        .where('id', id)
        .update({
          template_id: newTemplateId,
          send_type: newSendType,
          schedule_at: newScheduleAt,
          status: newStatus,
          updated_at: new Date(),
        })
        .returning('*');

      return updatedCampaign;
    });
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
}
