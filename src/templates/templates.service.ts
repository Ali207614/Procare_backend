import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { Knex } from 'knex';
import { InjectKnex } from 'nestjs-knex';
import { ITemplate, ITemplateHistory } from 'src/common/types/template.interface';
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
  }): Promise<ITemplate[]> {
    let query = this.knex('templates').select('*');
    if (filters.status) query = query.where('status', filters.status);
    if (filters.language) query = query.where('language', filters.language);
    return query.limit(filters.limit).offset(filters.offset);
  }

  async findOne(id: string): Promise<ITemplate> {
    const template: ITemplate | undefined = await this.knex('templates').where('id', id).first();
    if (!template)
      throw new NotFoundException({
        message: 'Template not found',
        location: 'template',
        id,
      });
    return template;
  }

  async update(id: string, updateTemplateDto: UpdateTemplateDto): Promise<{ message: string }> {
    const oldTemplate: ITemplate = await this.findOne(id);
    const histories: ITemplateHistory[] = await this.knex('template_histories')
      .where('template_id', id)
      .orderBy('updated_at', 'desc');
    if (histories.length >= 5) {
      await this.knex('template_histories')
        .where('id', histories[histories.length - 1].id)
        .del();
    }
    await this.knex('template_histories').insert({
      template_id: id,
      version: histories.length + 1,
      body: oldTemplate.body,
      variables: oldTemplate.variables,
      author_id: updateTemplateDto.created_by || oldTemplate.created_by,
      updated_at: new Date(),
    });
    return { message: 'Template history updated successfully' };
  }

  async remove(id: string): Promise<{ message: string }> {
    const template = await this.knex('templates').where('id', id).first();
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    await this.knex('templates').where('id', id).update({ status: 'deleted' });
    return { message: 'Template status updated to deleted' };
  }
}
