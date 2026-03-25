import { Injectable } from '@nestjs/common';
import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import { RepairOrderRejectCause } from 'src/common/types/repair-order-reject-cause.interface';
import { RedisService } from 'src/common/redis/redis.service';
import { LoggerService } from 'src/common/logger/logger.service';

@Injectable()
export class RepairOrderRejectCausesService {
  private readonly tableName = 'repair_order_reject_causes';
  private readonly redisKeyPrefix = 'repair_order_reject_causes:';

  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly redisService: RedisService,
    private readonly logger: LoggerService,
  ) {}

  async findAll(): Promise<RepairOrderRejectCause[]> {
    const cacheKey = `${this.redisKeyPrefix}all`;
    const cached = await this.redisService.get<RepairOrderRejectCause[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const causes = await this.knex<RepairOrderRejectCause>(this.tableName)
      .select('*')
      .orderBy('created_at', 'desc');

    await this.redisService.set(cacheKey, causes, 3600);
    return causes;
  }
}
