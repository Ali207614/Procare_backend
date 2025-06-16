import {
    CanActivate,
    ExecutionContext,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import { RedisService } from 'src/common/redis/redis.service';
import { ParseUUIDPipe } from '../pipe/parse-uuid.pipe';
import { RepairOrderStatusesService } from 'src/repair-order-statuses/repair-order-statuses.service';

@Injectable()
export class RepairOrderStatusExistGuard implements CanActivate {
    constructor(
        private readonly repairOrderStatusService: RepairOrderStatusesService
    ) { }

    private readonly redisKeyPrefix = 'repair_order_statuses:id:';

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const statusId = request.params?.id;

        try {
            const parser = new ParseUUIDPipe();
            parser.transform(statusId);
        } catch (err) {
            throw err;
        }

        request.status = await this.repairOrderStatusService.getOrLoadStatusById(statusId);
        return true;
    }
}
