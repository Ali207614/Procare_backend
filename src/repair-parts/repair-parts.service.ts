import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Knex } from 'knex';
import { InjectKnex } from 'nestjs-knex';
import { CreateRepairPartDto } from 'src/repair-parts/dto/create-repair-part.dto';
import { UpdateRepairPartDto } from 'src/repair-parts/dto/update-repair-part.dto';
import { RepairPart } from 'src/common/types/repair-part.interface';

@Injectable()
export class RepairPartsService {
  constructor(@InjectKnex() private readonly knex: Knex) {}

  async create(createRepairPartDto: CreateRepairPartDto, createdBy: string): Promise<RepairPart> {
    const { problem_category_id, part_name_uz } = createRepairPartDto;

    const existingPart: RepairPart | undefined = await this.knex('repair_parts')
      .where({ problem_category_id, part_name_uz })
      .first();
    if (existingPart) {
      throw new BadRequestException({
        message: 'Part name must be unique for this problem category',
        location: 'part_name_uz',
      });
    }

    const categoryExists = await this.knex('problem_categories')
      .where({ id: problem_category_id })
      .first();
    if (!categoryExists) {
      throw new NotFoundException({
        message: 'Problem category not found',
        location: 'problem_category_id',
      });
    }

    const [newPart]: RepairPart[] = await this.knex('repair_parts')
      .insert({
        ...createRepairPartDto,
        created_by: createdBy,
        created_at: this.knex.fn.now(),
        updated_at: this.knex.fn.now(),
      })
      .returning('*');

    return newPart;
  }

  async findAll(): Promise<RepairPart[]> {
    return this.knex('repair_parts').whereNot('status', 'Deleted').select('*');
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

    if (updateRepairPartDto.problem_category_id && updateRepairPartDto.part_name_uz) {
      const existingPart: RepairPart | undefined = await this.knex('repair_parts')
        .where({
          problem_category_id: updateRepairPartDto.problem_category_id,
          part_name_uz: updateRepairPartDto.part_name_uz,
        })
        .whereNot('id', id)
        .first();
      if (existingPart) {
        throw new BadRequestException({
          message: 'Part name must be unique for this problem category',
          location: 'part_name_uz',
        });
      }
    }

    if (updateRepairPartDto.problem_category_id) {
      const categoryExists = await this.knex('problem_categories')
        .where({ id: updateRepairPartDto.problem_category_id })
        .first();
      if (!categoryExists) {
        throw new NotFoundException({
          message: 'Problem category not found',
          location: 'problem_category_id',
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
