/*
https://docs.nestjs.com/providers#services
*/

import { Injectable } from '@nestjs/common';
import { Knex } from 'knex';
import { InjectKnex } from 'nestjs-knex';
import { loadSQL } from 'src/common/utils/sql-loader.util';

@Injectable()
export class CouriersService {
  constructor(@InjectKnex() private readonly knex: Knex) {}

  async findAll({
    search,
    limit = 20,
    offset = 0,
  }: {
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<Courier> {
    const sql = loadSQL('couriers/queries/find-all.sql');

    const result: { rows: Courier } = await this.knex.raw(sql, {
      search: search ?? null,
      limit,
      offset,
    });

    return result.rows;
  }
}
