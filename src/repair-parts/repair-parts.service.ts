import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Knex } from 'knex';
import { InjectKnex } from 'nestjs-knex';
import { CreateRepairPartDto } from 'src/repair-parts/dto/create-repair-part.dto';
import { UpdateRepairPartDto } from 'src/repair-parts/dto/update-repair-part.dto';
import { RepairPart } from 'src/common/types/repair-part.interface';
import { AssignRepairPartsToCategoryDto } from 'src/repair-parts/dto/assign-repair-parts.dto';
import { PaginationResult } from 'src/common/utils/pagination.util';

@Injectable()
export class RepairPartsService {
  constructor(@InjectKnex() private readonly knex: Knex) {}

  async assignRepairPartsToProblemCategory(dto: AssignRepairPartsToCategoryDto): Promise<void> {
    const { problem_category_id, repair_parts } = dto;

    const repair_part_ids = repair_parts.map((part) => part.id);

    const existingParts: RepairPart[] = await this.knex('repair_parts')
      .whereIn('id', repair_part_ids)
      .andWhere({ status: 'Open' })
      .select('id');

    const validIds = existingParts.map((p) => p.id);
    const invalidIds = repair_part_ids.filter((id) => !validIds.includes(id));

    if (invalidIds.length > 0) {
      throw new BadRequestException({
        message: 'Some repair_part IDs are invalid',
        location: 'repair_parts',
        invalidIds,
      });
    }

    await this.knex('repair_part_assignments').where({ problem_category_id }).delete();

    const now = this.knex.fn.now();
    const rowsToInsert = repair_parts.map(({ id, is_required }) => ({
      id: this.knex.raw('gen_random_uuid()'),
      problem_category_id,
      repair_part_id: id,
      is_required,
      created_at: now,
      updated_at: now,
    }));

    await this.knex('repair_part_assignments').insert(rowsToInsert);
  }

  async create(createRepairPartDto: CreateRepairPartDto, createdBy: string): Promise<RepairPart> {
    const { part_name_uz, part_name_ru, part_name_en } = createRepairPartDto;

    const existingPart: RepairPart | undefined = await this.knex('repair_parts')
      .where((qb): void => {
        void qb
          .whereRaw('LOWER(part_name_uz) = ?', [part_name_uz.toLowerCase()])
          .orWhereRaw('LOWER(part_name_ru) = ?', [part_name_ru.toLowerCase()])
          .orWhereRaw('LOWER(part_name_en) = ?', [part_name_en.toLowerCase()]);
      })
      .first();

    if (existingPart) {
      throw new BadRequestException({
        message: 'Part name (UZ/RU/EN) must be unique',
        location: 'part_name',
      });
    }

    const [newPart]: RepairPart[] = await this.knex('repair_parts')
      .insert({
        ...createRepairPartDto,
        created_by: createdBy,
        status: 'Open',
        created_at: this.knex.fn.now(),
        updated_at: this.knex.fn.now(),
      })
      .returning('*');

    return newPart;
  }

  async findAll(limit = 20, offset = 0, search?: string): Promise<PaginationResult<RepairPart>> {
    let baseQuery = this.knex<RepairPart>('repair_parts').whereNot('status', 'Deleted');

    if (search) {
      baseQuery = baseQuery.andWhere((qb) => {
        void qb
          .whereILike('part_name_uz', `%${search}%`)
          .orWhereILike('part_name_ru', `%${search}%`)
          .orWhereILike('part_name_en', `%${search}%`);
      });
    }

    const [rows, countResult] = await Promise.all([
      baseQuery.clone().orderBy('sort', 'asc').offset(offset).limit(limit),
      baseQuery.clone().clearSelect().clearOrder().count<{ count: string }[]>('* as count'),
    ]);

    return {
      rows,
      total: Number(countResult[0]?.count ?? 0),
      limit,
      offset,
    };
  }

  async findOne(id: string): Promise<RepairPart> {
    const part: RepairPart | undefined = await this.knex('repair_parts')
      .where({ id })
      .whereNot('status', 'Deleted')
      .first();
    if (!part) {
      throw new NotFoundException({
        message: 'Repair part not found',
        location: 'repair_parts',
      });
    }
    return part;
  }

  async update(id: string, updateRepairPartDto: UpdateRepairPartDto): Promise<{ message: string }> {
    const { part_name_uz, part_name_ru, part_name_en } = updateRepairPartDto;

    const part: RepairPart | undefined = await this.knex('repair_parts')
      .where({ id })
      .whereNot('status', 'Deleted')
      .first();
    if (!part) {
      throw new NotFoundException({
        message: 'Repair part not found',
        location: 'repair_parts',
      });
    }

    if (part_name_uz || part_name_ru || part_name_en) {
      const existingPart: RepairPart | undefined = await this.knex('repair_parts')
        .whereNot('id', id)
        .andWhere((qb) => {
          if (part_name_uz) {
            void qb.orWhereRaw('LOWER(part_name_uz) = ?', [part_name_uz.toLowerCase()]);
          }
          if (part_name_ru) {
            void qb.orWhereRaw('LOWER(part_name_ru) = ?', [part_name_ru.toLowerCase()]);
          }
          if (part_name_en) {
            void qb.orWhereRaw('LOWER(part_name_en) = ?', [part_name_en.toLowerCase()]);
          }
        })
        .first();

      if (existingPart) {
        throw new BadRequestException({
          message: 'Part name (UZ/RU/EN) must be unique',
          location: 'part_name_uz / part_name_ru / part_name_en',
        });
      }
    }

    await this.knex('repair_parts')
      .where({ id })
      .update({
        ...updateRepairPartDto,
        updated_at: this.knex.fn.now(),
      })
      .returning('*');
    return { message: 'Repair part updated successfully' };
  }

  async delete(id: string): Promise<{ message: string }> {
    const part: RepairPart | undefined = await this.knex('repair_parts')
      .where({ id })
      .whereNot('status', 'Deleted')
      .first();
    if (!part) {
      throw new NotFoundException({
        message: 'Repair part not found',
        location: 'repair_parts',
      });
    }

    await this.knex('repair_parts')
      .where({ id })
      .update({ status: 'Deleted', updated_at: this.knex.fn.now() });
    return { message: 'Repair part deleted successfully' };
  }
}
