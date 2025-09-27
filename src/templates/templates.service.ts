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
import { FindAllTemplatesDto } from 'src/templates/dto/find-all.dto';
import { PaginationResult } from 'src/common/utils/pagination.util';

@Injectable()
export class TemplatesService {
  constructor(@InjectKnex() private readonly knex: Knex) {}

  async create(createTemplateDto: CreateTemplateDto, admin: AdminPayload): Promise<ITemplate> {
    const existing = await this.knex('templates')
      .whereRaw('LOWER(title) = LOWER(?)', [createTemplateDto.title.trim()])
      .first();

    if (existing) {
      throw new BadRequestException({
        message: 'Template with this title already exists',
        location: 'title',
      });
    }
    const [template]: ITemplate[] = await this.knex('templates')
      .insert({
        title: createTemplateDto.title,
        language: createTemplateDto.language,
        body: createTemplateDto.body,
        variables: JSON.stringify(createTemplateDto.variables ?? []),
        status: createTemplateDto.status,
        created_by: admin.id,
      })
      .returning('*');
    return template;
  }

  async findAll(dto: FindAllTemplatesDto): Promise<PaginationResult<ITemplateWithHistories>> {
    const baseQuery = this.knex('templates as t')
      .select(
        't.*',
        this.knex.raw(`
        COALESCE(
          (
            SELECT json_agg(th ORDER BY th.version DESC)
            FROM template_histories th
            WHERE th.template_id = t.id
          ),
          '[]'::json
        ) AS histories
      `),
        this.knex.raw(`
        json_build_object(
          'id', a.id,
          'first_name', a.first_name,
          'last_name', a.last_name
        ) as created_by_admin
      `),
      )
      .leftJoin('admins as a', 't.created_by', 'a.id')
      .modify((qb) => {
        if (dto.status?.length) {
          void qb.whereIn('t.status', dto.status);
        }
        if (dto.language) {
          void qb.where('t.language', dto.language);
        }
        if (dto.search) {
          void qb.whereRaw('LOWER(t.title) LIKE ?', [`%${dto.search.toLowerCase()}%`]);
        }
      })
      .orderBy('t.created_at', 'desc'); // asosiy sort

    const [{ count }] = await baseQuery
      .clone()
      .clearSelect()
      .clearOrder()
      .count<{ count: string }[]>('* as count');

    const rows = await baseQuery.limit(dto.limit).offset(dto.offset);

    return {
      total: Number(count),
      limit: dto.limit,
      offset: dto.offset,
      rows: rows as ITemplateWithHistories[],
    };
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

  async update(
    id: string,
    updateTemplateDto: UpdateTemplateDto,
    admin: AdminPayload,
  ): Promise<{ message: string }> {
    return this.knex.transaction(async (trx) => {
      const oldTemplate: ITemplate = await this.findOne(id);

      if (
        updateTemplateDto.title &&
        updateTemplateDto.title.toLowerCase() !== oldTemplate.title.toLowerCase()
      ) {
        const existing: ITemplate | undefined = await trx<ITemplate>('templates')
          .whereRaw('LOWER(title) = ?', [updateTemplateDto.title.toLowerCase()])
          .whereNot('id', id)
          .first();

        if (existing) {
          throw new BadRequestException({
            message: 'Template with this title already exists',
            location: 'title',
          });
        }
      }

      const lastHistory: ITemplateHistory | undefined = await trx<ITemplateHistory>(
        'template_histories',
      )
        .where('template_id', id)
        .orderBy('version', 'desc')
        .first();

      const newVersion = lastHistory ? lastHistory.version + 1 : 1;

      await trx('template_histories').insert({
        title: oldTemplate.title,
        language: oldTemplate.language,
        template_id: id,
        version: newVersion,
        body: oldTemplate.body,
        variables: JSON.stringify(oldTemplate.variables ?? []),
        created_by: admin.id,
        status: oldTemplate.status,
        updated_at: new Date(),
      });

      const histories: ITemplateHistory[] = await trx<ITemplateHistory>('template_histories')
        .where('template_id', id)
        .orderBy('version', 'desc');

      if (histories.length > 5) {
        const toDelete = histories.slice(5);
        const idsToDelete = toDelete.map((h) => h.id);
        await trx('template_histories').whereIn('id', idsToDelete).del();
      }

      await trx('templates')
        .where('id', id)
        .update({
          title: updateTemplateDto.title || oldTemplate.title,
          language: updateTemplateDto.language || oldTemplate.language,
          body: updateTemplateDto.body || oldTemplate.body,
          variables: updateTemplateDto.variables
            ? JSON.stringify(updateTemplateDto.variables)
            : JSON.stringify(oldTemplate.variables),
          status: updateTemplateDto.status || oldTemplate.status,
          updated_at: new Date(),
        });

      return { message: 'Template and history updated successfully' };
    });
  }

  async remove(id: string): Promise<{ message: string }> {
    const template: ITemplate | undefined = await this.knex<ITemplate>('templates')
      .where('id', id)
      .first();
    if (!template) {
      throw new NotFoundException({
        message: 'Template not found',
        location: 'template',
      });
    }
    await this.knex<ITemplate>('templates').where('id', id).update({ status: 'Deleted' });
    return { message: 'Template status updated to archived' };
  }
}
