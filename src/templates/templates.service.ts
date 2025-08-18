import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { Knex } from 'knex';
import { InjectKnex } from 'nestjs-knex';
import {
  ITemplate,
  ITemplateHistory,
  ITemplateWithHistories,
} from 'src/common/types/template.interface';
import { AdminPayload } from 'src/common/types/admin-payload.interface';

@Injectable()
export class TemplatesService {
  constructor(@InjectKnex() private readonly knex: Knex) {}

  async create(createTemplateDto: CreateTemplateDto, admin: AdminPayload): Promise<ITemplate> {
    const existing = await this.knex('templates')
      .whereRaw('LOWER(title) = LOWER(?)', [createTemplateDto.title])
      .first();
    if (existing) {
      throw new BadRequestException({
        message: 'Template with this title already exists',
        location: 'title',
      });
    }
    const [template]: ITemplate[] = await this.knex('templates')
      .insert({
        ...createTemplateDto,
        created_by: admin.id,
      })
      .returning('*');
    return template;
  }

  async findAll(filters: {
    limit: number;
    offset: number;
    status?: string;
    language?: string;
  }): Promise<ITemplateWithHistories[]> {
    return this.knex('templates')
      .select(
        'templates.*',
        this.knex.raw(`
        COALESCE(
          (SELECT json_agg(th.* ORDER BY th.updated_at DESC)
           FROM template_histories th
           WHERE th.template_id = templates.id),
          '[]'::json
        ) AS histories
      `),
      )
      .modify((qb) => {
        if (filters.status) void qb.where('status', filters.status);
        if (filters.language) void qb.where('language', filters.language);
      })
      .limit(filters.limit)
      .offset(filters.offset);
  }

  async findOne(id: string): Promise<ITemplateWithHistories> {
    const template: ITemplateWithHistories = await this.knex('templates')
      .select(
        'templates.*',
        this.knex.raw(`
        COALESCE(
          (SELECT json_agg(th.* ORDER BY th.updated_at DESC)
           FROM template_histories th
           WHERE th.template_id = templates.id),
          '[]'::json
        ) AS histories
      `),
      )
      .where('templates.id', id)
      .first();

    if (!template) {
      throw new NotFoundException({
        message: 'Template not found',
        location: 'template',
        id,
      });
    }

    return template;
  }

  async update(id: string, updateTemplateDto: UpdateTemplateDto): Promise<{ message: string }> {
    return this.knex.transaction(async (trx) => {
      const oldTemplate: ITemplate = await this.findOne(id);

      if (
        updateTemplateDto.title &&
        updateTemplateDto.title.toLowerCase() !== oldTemplate.title.toLowerCase()
      ) {
        const existing = await trx('templates')
          .whereRaw('LOWER(title) = ?', [updateTemplateDto.title.toLowerCase()])
          .whereNot('id', id)
          .first();
        if (existing) {
          throw new BadRequestException('Title already exists (case-insensitive)');
        }
      }

      const histories: ITemplateHistory[] = await trx('template_histories')
        .where('template_id', id)
        .orderBy('updated_at', 'desc');
      if (histories.length >= 5) {
        await trx('template_histories')
          .where('id', histories[histories.length - 1].id)
          .del();
      }
      await trx('template_histories').insert({
        template_id: id,
        version: histories.length + 1,
        body: oldTemplate.body,
        variables: oldTemplate.variables,
        author_id: updateTemplateDto.created_by || oldTemplate.created_by,
        updated_at: new Date(),
      });

      await trx('templates')
        .where('id', id)
        .update({
          title: updateTemplateDto.title || oldTemplate.title,
          language: updateTemplateDto.language || oldTemplate.language,
          body: updateTemplateDto.body || oldTemplate.body,
          variables: updateTemplateDto.variables ?? oldTemplate.variables,
          status: updateTemplateDto.status || oldTemplate.status,
          updated_at: new Date(),
        });

      return { message: 'Template and history updated successfully' };
    });
  }

  async remove(id: string): Promise<{ message: string }> {
    const template = await this.knex('templates').where('id', id).first();
    if (!template) {
      throw new NotFoundException({
        message: 'Template not found',
        location: 'template',
      });
    }
    await this.knex('templates').where('id', id).update({ status: 'archived' });
    return { message: 'Template status updated to archived' };
  }
}
