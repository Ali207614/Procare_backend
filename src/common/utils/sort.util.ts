import { Knex } from 'knex';

export async function getNextSortValue(
  knex: Knex,
  tableName: string,
  options?: { column?: string; where?: Record<string, any> },
): Promise<number> {
  const column = options?.column ?? 'sort';
  const trx = await knex.transaction();
  try {
    let query = trx(tableName).max(`${column} as max`).forUpdate();
    if (options?.where) {
      query = query.where(options.where);
    }
    const [{ max }] = await query;
    await trx.commit();
    return ((max ?? 0) + 1) as number;
  } catch (error) {
    await trx.rollback();
    throw error;
  }
}
