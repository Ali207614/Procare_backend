import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import { CreateRepairOrderStatusTransitionDto } from './dto/create-repair-order-status-transition.dto';
import { RepairOrderStatusesService } from '../repair-order-statuses/repair-order-statuses.service';
import { RedisService } from 'src/common/redis/redis.service';
import { RepairOrderStatusTransition } from 'src/common/types/repair-order-status-transition.interface';
import { PaginationResult } from 'src/common/utils/pagination.util';
import { RepairOrderStatus } from 'src/common/types/repair-order-status.interface';
import { LoggerService } from 'src/common/logger/logger.service';

@Injectable()
export class RepairOrderStatusTransitionsService {
  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly statusService: RepairOrderStatusesService,
    private readonly redisService: RedisService,
    private readonly logger: LoggerService,
  ) {}

  private readonly redisKey = `repair_order_status_transitions:from:`;

  async create(
    from_status_id: string,
    dto: CreateRepairOrderStatusTransitionDto,
  ): Promise<RepairOrderStatusTransition[]> {
    const { to_status_ids } = dto;

    const fromStatus = await this.statusService.getOrLoadStatusById(from_status_id);
    const branchId = fromStatus.branch_id;

    const statuses: PaginationResult<RepairOrderStatus> =
      await this.statusService.findAllStatuses(branchId);
    const validStatusIds = statuses.rows.map((s) => s.id);

    for (const id of to_status_ids) {
      if (!validStatusIds.includes(id)) {
        throw new BadRequestException({
          message: `Invalid to_status_id: ${id}`,
          location: 'to_status_ids',
        });
      }
    }

    const trx = await this.knex.transaction();

    try {
      await trx('repair_order_status_transitions').where({ from_status_id }).del();

      const inserts = to_status_ids.map((toId) => ({
        from_status_id,
        to_status_id: toId,
      }));

      const inserted: RepairOrderStatusTransition[] = await trx('repair_order_status_transitions')
        .insert(inserts)
        .returning('*');

      await trx.commit();

      const redisKey = `${this.redisKey}${from_status_id}`;
      await this.redisService.set(redisKey, inserted, 3600);

      return inserted;
    } catch (error) {
      await trx.rollback();
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Failed to delete status `);
      throw new BadRequestException({
        message: 'Failed to upsert transitions',
        location: 'upsert_transitions',
      });
    }
  }

  async findAll(): Promise<RepairOrderStatusTransition[]> {
    return this.knex('repair_order_status_transitions').select('*').orderBy('created_at', 'desc');
  }
}
