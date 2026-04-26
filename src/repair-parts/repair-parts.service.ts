import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Knex } from 'knex';
import { InjectKnex } from 'nestjs-knex';
import { CreateRepairPartDto } from 'src/repair-parts/dto/create-repair-part.dto';
import { UpdateRepairPartDto } from 'src/repair-parts/dto/update-repair-part.dto';
import { RepairPart } from 'src/common/types/repair-part.interface';
import { AssignRepairPartsToCategoryDto } from 'src/repair-parts/dto/assign-repair-parts.dto';
import { PaginationResult } from 'src/common/utils/pagination.util';
import { FindAllPartsDto } from 'src/repair-parts/dto/find-all.dto';
import { HistoryService } from 'src/history/history.service';

@Injectable()
export class RepairPartsService {
  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly historyService: HistoryService,
  ) {}

  async assignRepairPartsToProblemCategory(
    dto: AssignRepairPartsToCategoryDto,
    adminId?: string,
  ): Promise<void> {
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

    await this.knex.transaction(async (trx) => {
      const previousAssignments: { repair_part_id: string }[] = await trx('repair_part_assignments')
        .where({ problem_category_id })
        .select('repair_part_id');
      const previousIds = previousAssignments.map((assignment) => assignment.repair_part_id);
      const nextIds = [...new Set(repair_part_ids)];

      await trx('repair_part_assignments').where({ problem_category_id }).delete();

      if (repair_parts.length > 0) {
        const now = trx.fn.now();
        const rowsToInsert = repair_parts.map(({ id, is_required }) => ({
          id: trx.raw('gen_random_uuid()'),
          problem_category_id,
          repair_part_id: id,
          is_required,
          created_at: now,
          updated_at: now,
        }));

        await trx('repair_part_assignments').insert(rowsToInsert);
      }

      await this.recordRelationDiff(trx, {
        actorAdminId: adminId,
        fromTable: 'problem_categories',
        fromPk: problem_category_id,
        toTable: 'repair_parts',
        fieldPath: 'repair_part_id',
        beforeIds: previousIds,
        afterIds: nextIds,
      });
    });
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
      .andWhere('status', '!=', 'Deleted')
      .first();

    if (existingPart) {
      throw new BadRequestException({
        message: 'Part name (UZ/RU/EN) must be unique',
        location: 'part_name',
      });
    }

    const newPart = await this.knex.transaction(async (trx) => {
      const [created]: RepairPart[] = await trx('repair_parts')
        .insert({
          ...createRepairPartDto,
          created_by: createdBy,
          status: 'Open',
          created_at: trx.fn.now(),
          updated_at: trx.fn.now(),
        })
        .returning('*');

      await this.historyService.recordEntityCreated({
        db: trx,
        entityTable: 'repair_parts',
        entityPk: created.id,
        entityLabel: created.part_name_uz ?? null,
        actor: { actorPk: createdBy },
        values: created as unknown as Record<string, unknown>,
      });

      return created;
    });

    return newPart;
  }

  async findAll(query: FindAllPartsDto): Promise<PaginationResult<RepairPart>> {
    const {
      limit = 10,
      offset = 0,
      search,
      status,
      problem_category_ids,
      exclude_problem_category_ids,
    } = query;

    const baseQuery = this.knex<RepairPart>('repair_parts as rp')
      .leftJoin('repair_part_assignments as rpa', 'rp.id', 'rpa.repair_part_id')
      .whereNot('rp.status', 'Deleted');

    if (status?.length) {
      void baseQuery.whereIn('rp.status', status);
    }

    if (search?.length) {
      const lowered = search.toLowerCase();
      void baseQuery.andWhere((qb) => {
        void qb
          .whereRaw('LOWER(rp.part_name_uz) ILIKE ?', [`%${lowered}%`])
          .orWhereRaw('LOWER(rp.part_name_ru) ILIKE ?', [`%${lowered}%`])
          .orWhereRaw('LOWER(rp.part_name_en) ILIKE ?', [`%${lowered}%`]);
      });
    }

    if (problem_category_ids?.length) {
      void baseQuery.andWhere((qb) => {
        void qb.whereIn('rpa.problem_category_id', problem_category_ids);
      });
    }

    if (exclude_problem_category_ids?.length) {
      void baseQuery.whereNotExists(function () {
        void this.select(1)
          .from('repair_part_assignments as ex')
          .whereRaw('ex.repair_part_id = rp.id')
          .whereIn('ex.problem_category_id', exclude_problem_category_ids);
      });
    }

    const [rows, countResult] = await Promise.all([
      baseQuery
        .clone()
        .select('rp.*', 'rpa.is_required')
        .orderBy('rp.created_at', 'desc')
        .offset(offset)
        .limit(limit),
      baseQuery
        .clone()
        .clearSelect()
        .clearOrder()
        .countDistinct<{ count: string }[]>('rp.id as count'),
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

  async update(
    id: string,
    updateRepairPartDto: UpdateRepairPartDto,
    adminId?: string,
  ): Promise<{ message: string }> {
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
        .whereNot('status', 'Deleted')
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

    await this.knex.transaction(async (trx) => {
      const updateData = {
        ...updateRepairPartDto,
        updated_at: trx.fn.now(),
      };
      await trx('repair_parts').where({ id }).update(updateData);
      await this.historyService.recordEntityUpdated({
        db: trx,
        entityTable: 'repair_parts',
        entityPk: id,
        entityLabel: part.part_name_uz ?? null,
        actor: adminId ? { actorPk: adminId } : null,
        before: part as unknown as Record<string, unknown>,
        after: { ...part, ...updateData } as Record<string, unknown>,
        fields: Object.keys(updateRepairPartDto),
      });
    });
    return { message: 'Repair part updated successfully' };
  }

  async delete(id: string, adminId?: string): Promise<{ message: string }> {
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

    await this.knex.transaction(async (trx) => {
      await trx('repair_parts')
        .where({ id })
        .update({ status: 'Deleted', updated_at: trx.fn.now() });
      await this.historyService.recordEntityDeleted({
        db: trx,
        entityTable: 'repair_parts',
        entityPk: id,
        entityLabel: part.part_name_uz ?? null,
        actor: adminId ? { actorPk: adminId } : null,
        before: part as unknown as Record<string, unknown>,
        fields: ['status'],
      });
    });
    return { message: 'Repair part deleted successfully' };
  }

  private async recordRelationDiff(
    trx: Knex.Transaction,
    params: {
      actorAdminId?: string;
      fromTable: string;
      fromPk: string;
      toTable: string;
      fieldPath: string;
      beforeIds: string[];
      afterIds: string[];
    },
  ): Promise<void> {
    const before = new Set(params.beforeIds);
    const after = new Set(params.afterIds);

    for (const id of params.afterIds.filter((item) => !before.has(item))) {
      await this.historyService.recordRelationChanged({
        db: trx,
        actionKind: 'link',
        actor: params.actorAdminId ? { actorPk: params.actorAdminId } : null,
        from: { entityTable: params.fromTable, entityPk: params.fromPk },
        to: { entityTable: params.toTable, entityPk: id },
        fieldPath: params.fieldPath,
      });
    }

    for (const id of params.beforeIds.filter((item) => !after.has(item))) {
      await this.historyService.recordRelationChanged({
        db: trx,
        actionKind: 'unlink',
        actor: params.actorAdminId ? { actorPk: params.actorAdminId } : null,
        from: { entityTable: params.fromTable, entityPk: params.fromPk },
        to: { entityTable: params.toTable, entityPk: id },
        fieldPath: params.fieldPath,
      });
    }
  }
}
