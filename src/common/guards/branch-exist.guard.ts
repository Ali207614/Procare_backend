import { CanActivate, ExecutionContext, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import { RedisService } from 'src/common/redis/redis.service';
import { ParseUUIDPipe } from '../pipe/parse-uuid.pipe';

@Injectable()
export class BranchExistGuard implements CanActivate {
    constructor(
        @InjectKnex() private readonly knex: Knex,
        private readonly redisService: RedisService,
    ) { }

    private readonly redisKeyPrefix = 'branches:by_id:';

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        let branchId = request?.body?.branch_id || request?.qeuery?.branch_id || request.params.id

        try {
            const parser = new ParseUUIDPipe();
            branchId = parser.transform(branchId);
        } catch (err) {
            throw err;
        }

        const redisKey = `${this.redisKeyPrefix}${branchId}`;
        let branch = await this.redisService.get(redisKey);

        if (!branch) {
            branch = await this.knex('branches')
                .where({ id: branchId, is_active: true, status: 'Open' })
                .first();

            if (!branch) {
                throw new NotFoundException({
                    message: 'Branch not found or inactive',
                    location: 'branch_invalid',
                });
            }

            await this.redisService.set(redisKey, branch, 3600);
        }

        request.branch = branch;
        return true;
    }
}
