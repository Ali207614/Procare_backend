import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Knex } from 'knex';
import { InjectKnex } from 'nestjs-knex';
import { RedisClientType } from 'redis';
import { RedisService } from 'src/common/redis/redis.service';
import { CreateBranchDto } from './dto/create-branch.dto';

@Injectable()
export class BranchesService {
    constructor(
        @InjectKnex() private readonly knex: Knex,
        private readonly redisService: RedisService,
    ) { }

    private readonly redisKey = 'branches:all';
    private readonly redisKeyById = 'branches:by_id';


    async create(dto: CreateBranchDto, adminId: string) {
        const [branch] = await this.knex('branches')
            .insert({
                ...dto,
                created_by: adminId,
            })
            .returning('*');

        await this.redisService.flushByPrefix(`${this.redisKey}*`);
        await this.redisService.flushByPrefix(`${this.redisKeyById}*`);

        return branch;
    }

    async findAll(offset = 0, limit = 10, search?: string) {
        const isSearch = Boolean(search);
        const redisKey = isSearch ? null : `${this.redisKey}:${offset}:${limit}`;

        if (redisKey) {
            const cached = await this.redisService.get(redisKey);
            if (cached) return cached;
        }

        const query = this.knex('branches')
            .where({ is_active: true, status: 'Open' });

        if (isSearch) {
            query.andWhereILike('name', `%${search}%`);
        }

        const branches = await query
            .orderBy('sort', 'asc')
            .offset(offset)
            .limit(limit);

        if (redisKey) {
            await this.redisService.set(redisKey, branches, 3600);
        }

        return branches;
    }



    async findOne(id: string) {
        const branch = await this.knex('branches').where({ id }).first();
        if (!branch) throw new NotFoundException({
            message: 'Branch not found',
            location: "branch_not_found"
        });
        return branch;
    }
}
