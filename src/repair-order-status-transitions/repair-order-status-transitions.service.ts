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

  private readonly redisKey = `repair-order-status-transitions:from:`;
  private readonly redisKeyView = 'status_viewable:';
  private readonly table = 'repair-order-status-transitions';

  async create(
    from_status_id: string,
    dto: CreateRepairOrderStatusTransitionDto,
  ): Promise<RepairOrderStatusTransition[]> {
    const { to_status_ids } = dto;
    const roleId = dto.role_id ?? null;

    const fromStatus = await this.statusService.getOrLoadStatusById(from_status_id);
    const branchId = fromStatus.branch_id;

    const [role, statuses]: [{ id: string } | undefined, PaginationResult<RepairOrderStatus>] =
      await Promise.all([
        roleId
          ? this.knex<{ id: string }>('roles')
              .where('id', roleId)
              .andWhere('status', 'Open')
              .first()
          : undefined,
        this.statusService.findAllStatuses(branchId, 0, 1000),
      ]);

    if (roleId && !role) {
      throw new BadRequestException({
        message: 'Role not found or deleted',
        location: 'role_id',
      });
    }

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
      let deleteQuery = trx(this.table).where({ from_status_id });
      if (roleId) {
        deleteQuery = deleteQuery.andWhere({ role_id: roleId });
      } else {
        deleteQuery = deleteQuery.whereNull('role_id');
      }
      await deleteQuery.del();

      if (to_status_ids.length === 0) {
        await trx.commit();
        const redisKey = `${this.redisKey}${from_status_id}:${roleId ?? 'default'}`;
        await this.redisService.set(redisKey, [], 3600);
        await this.redisService.flushByPrefix(`${this.redisKeyView}${branchId}`);
        return [];
      }

      const inserts = to_status_ids.map((toId) => ({
        from_status_id,
        to_status_id: toId,
        role_id: roleId,
      }));

      const inserted: RepairOrderStatusTransition[] = await trx(this.table)
        .insert(inserts)
        .returning('*');

      await trx.commit();

      const redisKey = `${this.redisKey}${from_status_id}:${roleId ?? 'default'}`;
      await this.redisService.set(redisKey, inserted, 3600);

      await this.redisService.flushByPrefix(`${this.redisKeyView}${branchId}`);

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

  async findAll(
    params: {
      branchId?: string;
      roleId?: string | null;
    } = {},
  ): Promise<RepairOrderStatusTransition[]> {
    let query = this.knex<RepairOrderStatusTransition>(`${this.table} as transitions`)
      .select('transitions.*')
      .orderBy('transitions.created_at', 'desc');

    if (params.branchId) {
      query = query
        .join(
          'repair_order_statuses as from_status',
          'transitions.from_status_id',
          'from_status.id',
        )
        .where('from_status.branch_id', params.branchId)
        .andWhere('from_status.status', 'Open');
    }

    if (params.roleId === null) {
      query = query.whereNull('transitions.role_id');
    } else if (params.roleId) {
      query = query.where('transitions.role_id', params.roleId);
    }

    return query;
  }
}
