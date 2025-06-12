import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';

@Injectable()
export class PhoneProblemMappingsService {
    constructor(@InjectKnex() private readonly knex: Knex) { }

    async create(phone_category_id: string, problem_category_id: string) {
        const [result] = await this.knex('phone_categories as pc')
            .where('pc.id', phone_category_id)
            .andWhere('pc.status', 'Open')
            .select(
                'pc.*',
                this.knex.raw(`(
            SELECT COALESCE(JSON_AGG(row_to_json(c.*)), '[]')
            FROM phone_categories c
            WHERE c.parent_id = pc.id AND c.status = 'Open'
          ) as children`)
            );

        if (!result) {
            throw new BadRequestException({
                message: 'Phone category not found',
                location: 'phone_category_id',
            });
        }

        if (result.children?.length > 0) {
            throw new BadRequestException({
                message: 'Cannot link a problem to a phone category that has children',
                location: 'has_children',
            });
        }

        const problem = await this.knex('problem_categories')
            .where({ id: problem_category_id, status: 'Open' })
            .first();
        if (!problem) {
            throw new BadRequestException({
                message: 'Problem category not found',
                location: 'problem_category_id',
            });
        }

        const alreadyLinked = await this.knex('phone_problem_mappings')
            .where({ phone_category_id, problem_category_id })
            .first();
        if (alreadyLinked) {
            throw new BadRequestException({
                message: 'This problem is already linked to this phone category',
                location: 'duplicate_mapping',
            });
        }

        const [mapping] = await this.knex('phone_problem_mappings')
            .insert({ phone_category_id, problem_category_id })
            .returning('*');

        return mapping;
    }

    async delete(id: string) {
        const mapping = await this.knex('phone_problem_mappings')
            .where({ id })
            .first();

        if (!mapping) {
            throw new BadRequestException({
                message: 'Mapping not found',
                location: 'id',
            });
        }

        await this.knex('phone_problem_mappings')
            .where({ id })
            .delete();

        return { message: 'Mapping deleted successfully' };
    }
}
