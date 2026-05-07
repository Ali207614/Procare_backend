import { knex, Knex } from 'knex';
import { loadSQL } from 'src/common/utils/sql-loader.util';

describe('Repair order SQL smoke tests', () => {
  let knexInstance: Knex;

  beforeAll(async () => {
    knexInstance = knex({
      client: 'pg',
      connection: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5433', 10),
        user: process.env.DB_USER || 'test_user',
        password: process.env.DB_PASS || 'test_pass',
        database: process.env.DB_NAME || 'repair_order_test',
      },
      pool: { min: 1, max: 2 },
    });

    try {
      await knexInstance.raw('SELECT 1');
      await knexInstance.migrate.latest();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Skipping SQL smoke tests: ${message}`);
    }
  });

  afterAll(async () => {
    if (knexInstance) {
      await knexInstance.destroy();
    }
  });

  const skipIfDbUnavailable = async (): Promise<boolean> => {
    try {
      await knexInstance.raw('SELECT 1');
      return false;
    } catch {
      return true;
    }
  };

  it('prepares the repair order list SQL against the migrated schema', async () => {
    if (await skipIfDbUnavailable()) {
      return;
    }

    const listSql = loadSQL('repair-orders/queries/find-all-by-admin-branch.sql')
      .replace('/*ORDER_CLAUSE*/', 'ORDER BY ro.status_id, ro.sort ASC')
      .replace('/*ROW_NUMBER_ORDER*/', 'ORDER BY ro.sort ASC')
      .replace('/*ADDITIONAL_WHERE*/', '');

    await expect(
      knexInstance.raw(`EXPLAIN ${listSql}`, {
        branchId: '00000000-0000-4000-8000-000000000000',
        statusIds: ['00000000-0000-4000-8000-000000000001'],
        offset: 0,
        endRow: 20,
        limit: 20,
      }),
    ).resolves.toBeDefined();
  });

  it('prepares the repair order detail SQL against the migrated schema', async () => {
    if (await skipIfDbUnavailable()) {
      return;
    }

    const detailSql = loadSQL('repair-orders/queries/find-by-id.sql');

    await expect(
      knexInstance.raw(`EXPLAIN ${detailSql}`, {
        orderId: '00000000-0000-4000-8000-000000000000',
      }),
    ).resolves.toBeDefined();
  });
});
