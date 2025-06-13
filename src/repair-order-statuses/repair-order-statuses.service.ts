import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import { CreateRepairOrderStatusDto } from './dto/create-repair-order-status.dto';
import { getNextSortValue } from 'src/common/utils/sort.util';

@Injectable()
export class RepairOrderStatusesService {
    constructor(@InjectKnex() private readonly knex: Knex) { }

    async create(dto: CreateRepairOrderStatusDto, adminId: string) {
        const nextSort = await getNextSortValue(this.knex, 'repair_order_statuses');

        const [created] = await this.knex('repair_order_statuses')
            .insert({
                ...dto,
                sort: nextSort,
                created_by: adminId,
            })
            .returning('*');

        return created;
    }

    async findAll() {
        return this.knex('repair_order_statuses')
            .where({ is_active: true, status: 'Open' })
            .orderBy('sort', 'asc');
    }
}