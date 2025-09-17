import { Injectable } from '@nestjs/common';
import { Knex } from 'knex';
import { InjectKnex } from 'nestjs-knex';
import { loadSQL } from 'src/common/utils/sql-loader.util';
import { PaginationResult } from 'src/common/utils/pagination.util';
import { Courier } from 'src/common/types/courier.interface';

@Injectable()
export class CouriersService {
  constructor(@InjectKnex() private readonly knex: Knex) {}

  async findAll({
    search,
    limit = 20,
    offset = 0,
    branch_id,
  }: {
    search?: string;
    limit?: number;
    offset?: number;
    branch_id: string;
  }): Promise<PaginationResult<Courier>> {
    const sql = loadSQL('couriers/queries/find-all.sql');

    const result = await this.knex.raw(sql, {
      search: search ?? null,
      limit,
      offset,
      branch_id,
    });

    const rows: Courier[] = result.rows.map((r: Courier) => {
      const { total, ...rest } = r;
      return {
        ...rest,
        branches: r.branches ?? [],
      };
    });

    const total = result.rows.length > 0 ? Number(result.rows[0].total) : 0;

    return { rows, total, limit, offset };
  }
}
