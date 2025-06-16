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

@Injectable()
export class RepairOrderStatusExistGuard implements CanActivate {
    constructor(
        @InjectKnex() private readonly knex: Knex,
        private readonly redisService: RedisService,
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

        const redisKey = `${this.redisKeyPrefix}${statusId}`;
        let status = await this.redisService.get(redisKey);

        if (!status) {
            status = await this.knex('repair_order_statuses')
                .where({ id: statusId, status: 'Open' })
                .first();

            if (!status) {
                throw new NotFoundException({
                    message: 'Repair order status not found or inactive',
                    location: 'repair_order_status_invalid',
                });
            }

            await this.redisService.set(redisKey, status, 3600);
        }

        request.status = status;
        return true;
    }
}
