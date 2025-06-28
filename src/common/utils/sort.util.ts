import { Knex } from 'knex';

export async function getNextSortValue(
  knex: Knex,
  tableName: string,
  options?: { column?: string; where?: Record<string, any> },
): Promise<number> {
  const column = options?.column ?? 'sort';

  let query = knex(tableName).max(`${column} as max`);

  if (options?.where) {
    query = query.where(options.where);
  }

  const [{ max }] = await query;

  return (max ?? 0) + 1;
}
