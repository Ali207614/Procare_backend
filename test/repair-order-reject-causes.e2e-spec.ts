import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getKnexConnectionToken } from 'nestjs-knex';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { JwtAdminAuthGuard } from '../src/common/guards/jwt-admin.guard';
import { PermissionsGuard } from '../src/common/guards/permission.guard';
import { LoggerService } from '../src/common/logger/logger.service';
import { RedisService } from '../src/common/redis/redis.service';
import { RepairOrderRejectCause } from '../src/common/types/repair-order-reject-cause.interface';
import { RepairOrderRejectCausesController } from '../src/repair-order-reject-causes/repair-order-reject-causes.controller';
import { RepairOrderRejectCausesService } from '../src/repair-order-reject-causes/repair-order-reject-causes.service';

type RepairOrderRow = {
  id: string;
  reject_cause_id: string | null;
};

type FakeState = {
  repair_order_reject_causes: RepairOrderRejectCause[];
  repair_orders: RepairOrderRow[];
};

type TableName = keyof FakeState;
type TableRow<TTable extends TableName> = FakeState[TTable][number];

class FakeQueryBuilder<TTable extends TableName> {
  private filters: Array<(row: TableRow<TTable>) => boolean>;
  private sortSteps: Array<{
    field: keyof TableRow<TTable> & string;
    direction: 'asc' | 'desc';
  }>;
  private offsetValue: number;
  private limitValue: number | null;
  private aggregate: {
    type: 'count' | 'max';
    column: string;
  } | null;

  constructor(
    private readonly state: FakeState,
    private readonly table: TTable,
    filters: Array<(row: TableRow<TTable>) => boolean> = [],
    sortSteps: Array<{
      field: keyof TableRow<TTable> & string;
      direction: 'asc' | 'desc';
    }> = [],
    offsetValue = 0,
    limitValue: number | null = null,
    aggregate: {
      type: 'count' | 'max';
      column: string;
    } | null = null,
  ) {
    this.filters = filters;
    this.sortSteps = sortSteps;
    this.offsetValue = offsetValue;
    this.limitValue = limitValue;
    this.aggregate = aggregate;
  }

  clone(): FakeQueryBuilder<TTable> {
    return new FakeQueryBuilder(
      this.state,
      this.table,
      [...this.filters],
      [...this.sortSteps],
      this.offsetValue,
      this.limitValue,
      this.aggregate,
    );
  }

  where(
    arg1: string | Record<string, unknown>,
    arg2?: unknown,
    arg3?: unknown,
  ): FakeQueryBuilder<TTable> {
    return this.addFilter(arg1, arg2, arg3);
  }

  andWhere(
    arg1: string | Record<string, unknown>,
    arg2?: unknown,
    arg3?: unknown,
  ): FakeQueryBuilder<TTable> {
    return this.addFilter(arg1, arg2, arg3);
  }

  whereNot(arg1: string | Record<string, unknown>, arg2?: unknown): FakeQueryBuilder<TTable> {
    if (typeof arg1 === 'object') {
      return this.addPredicate((row) => !this.matchesObject(row, arg1));
    }

    return this.addPredicate((row) => row[arg1 as keyof TableRow<TTable>] !== arg2);
  }

  andWhereRaw(sql: string, bindings: unknown[]): FakeQueryBuilder<TTable> {
    return this.whereRaw(sql, bindings);
  }

  whereRaw(sql: string, bindings: unknown[]): FakeQueryBuilder<TTable> {
    if (sql.includes('LOWER(name) = LOWER(?)')) {
      const value = String(bindings[0] ?? '').toLowerCase();
      return this.addPredicate((row) => {
        const record = row as Record<string, unknown>;
        return String(record['name'] ?? '').toLowerCase() === value;
      });
    }

    if (sql.includes('LOWER(name) LIKE ?')) {
      const pattern = String(bindings[0] ?? '')
        .toLowerCase()
        .split('%')
        .join('');
      return this.addPredicate((row) => {
        const record = row as Record<string, unknown>;
        return String(record['name'] ?? '')
          .toLowerCase()
          .includes(pattern);
      });
    }

    return this;
  }

  select(..._fields: string[]): FakeQueryBuilder<TTable> {
    return this;
  }

  orderBy(
    field: keyof TableRow<TTable> & string,
    direction: 'asc' | 'desc' = 'asc',
  ): FakeQueryBuilder<TTable> {
    this.sortSteps.push({ field, direction });
    return this;
  }

  offset(value: number): FakeQueryBuilder<TTable> {
    this.offsetValue = value;
    return this;
  }

  limit(value: number): FakeQueryBuilder<TTable> {
    this.limitValue = value;
    return this;
  }

  first(): Promise<TableRow<TTable> | undefined> {
    return Promise.resolve(this.getRows()[0]);
  }

  count(_column: string): FakeQueryBuilder<TTable> {
    this.aggregate = {
      type: 'count',
      column: _column,
    };
    return this;
  }

  max(_column: string): FakeQueryBuilder<TTable> {
    this.aggregate = {
      type: 'max',
      column: _column,
    };
    return this;
  }

  update(data: Partial<TableRow<TTable>>): Promise<number> {
    const rows = this.getRows();
    rows.forEach((row) => {
      Object.assign(row, data);
    });
    return Promise.resolve(rows.length);
  }

  increment(field: keyof TableRow<TTable> & string, amount: number): Promise<number> {
    const rows = this.getRows();
    rows.forEach((row) => {
      const current = Number(row[field] ?? 0);
      const mutableRow = row as Record<string, unknown>;
      mutableRow[field] = current + amount;
    });
    return Promise.resolve(rows.length);
  }

  decrement(field: keyof TableRow<TTable> & string, amount: number): Promise<number> {
    const rows = this.getRows();
    rows.forEach((row) => {
      const current = Number(row[field] ?? 0);
      const mutableRow = row as Record<string, unknown>;
      mutableRow[field] = current - amount;
    });
    return Promise.resolve(rows.length);
  }

  insert(payload: Partial<TableRow<TTable>> | Array<Partial<TableRow<TTable>>>): {
    returning: (columns: string | string[]) => Promise<TableRow<TTable>[]>;
  } {
    const items = Array.isArray(payload) ? payload : [payload];
    const inserted = items.map((item) => {
      const row = {
        id: String(item.id ?? uuidv4()),
        ...item,
      } as TableRow<TTable>;

      this.getTableData().push(row);
      return row;
    });

    return {
      returning: (_columns: string | string[]): Promise<TableRow<TTable>[]> =>
        Promise.resolve(inserted),
    };
  }

  private addFilter(
    arg1: string | Record<string, unknown>,
    arg2?: unknown,
    arg3?: unknown,
  ): FakeQueryBuilder<TTable> {
    if (typeof arg1 === 'object') {
      return this.addPredicate((row) => this.matchesObject(row, arg1));
    }

    if (arg3 === undefined) {
      return this.addPredicate((row) => row[arg1 as keyof TableRow<TTable>] === arg2);
    }

    return this.addPredicate((row) => {
      const value = row[arg1 as keyof TableRow<TTable>];

      if (typeof value !== 'number') {
        return false;
      }

      const compared = Number(arg3);
      switch (arg2) {
        case '>':
          return value > compared;
        case '>=':
          return value >= compared;
        case '<':
          return value < compared;
        case '<=':
          return value <= compared;
        default:
          return value === compared;
      }
    });
  }

  private addPredicate(predicate: (row: TableRow<TTable>) => boolean): FakeQueryBuilder<TTable> {
    this.filters.push(predicate);
    return this;
  }

  private matchesObject(row: TableRow<TTable>, criteria: Record<string, unknown>): boolean {
    return Object.entries(criteria).every(([key, value]) => {
      return row[key as keyof TableRow<TTable>] === value;
    });
  }

  private getRows(): TableRow<TTable>[] {
    const source = this.getTableData();
    const filtered = source.filter((row) => this.filters.every((predicate) => predicate(row)));
    const sorted = [...filtered].sort((left, right) => this.compareRows(left, right));
    const sliced = sorted.slice(
      this.offsetValue,
      this.limitValue === null ? undefined : this.offsetValue + this.limitValue,
    );

    return sliced;
  }

  private compareRows(left: TableRow<TTable>, right: TableRow<TTable>): number {
    for (const step of this.sortSteps) {
      const leftValue = left[step.field];
      const rightValue = right[step.field];

      if (leftValue === rightValue) {
        continue;
      }

      if (leftValue === undefined || leftValue === null) {
        return step.direction === 'asc' ? -1 : 1;
      }

      if (rightValue === undefined || rightValue === null) {
        return step.direction === 'asc' ? 1 : -1;
      }

      if (leftValue < rightValue) {
        return step.direction === 'asc' ? -1 : 1;
      }

      return step.direction === 'asc' ? 1 : -1;
    }

    return 0;
  }

  private getTableData(): Array<TableRow<TTable>> {
    return this.state[this.table] as Array<TableRow<TTable>>;
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.resolve().then(onfulfilled ?? undefined, onrejected ?? undefined);
  }

  private resolve(): Promise<unknown> {
    if (this.aggregate?.type === 'count') {
      return Promise.resolve([{ count: String(this.getRows().length) }]);
    }

    if (this.aggregate?.type === 'max') {
      const column = this.aggregate.column.split(' as ')[0].trim();
      const max = this.getRows().reduce<number | null>((current, row) => {
        const record = row as Record<string, unknown>;
        const rawValue = record[column];
        const value = typeof rawValue === 'number' ? rawValue : null;
        if (value === null) {
          return current;
        }

        if (current === null) {
          return value;
        }

        return value > current ? value : current;
      }, null);

      return Promise.resolve([{ max }]);
    }

    return Promise.resolve(this.getRows());
  }
}

type FakeTransaction = (<TTable extends TableName>(table: TTable) => FakeQueryBuilder<TTable>) & {
  commit: jest.Mock<Promise<void>, []>;
  rollback: jest.Mock<Promise<void>, []>;
};

type FakeKnex = (<TTable extends TableName>(table: TTable) => FakeQueryBuilder<TTable>) & {
  transaction: jest.Mock<Promise<FakeTransaction>, []>;
};

function createFakeKnex(state: FakeState): FakeKnex {
  const makeBuilder = <TTable extends TableName>(table: TTable): FakeQueryBuilder<TTable> =>
    new FakeQueryBuilder(state, table);

  const transaction = ((table: TableName): FakeQueryBuilder<TableName> =>
    makeBuilder(table)) as FakeTransaction;
  transaction.commit = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
  transaction.rollback = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);

  const fakeKnex = ((table: TableName): FakeQueryBuilder<TableName> =>
    makeBuilder(table)) as FakeKnex;
  fakeKnex.transaction = jest.fn<Promise<FakeTransaction>, []>().mockResolvedValue(transaction);

  return fakeKnex;
}

describe('RepairOrderRejectCauses endpoints', () => {
  let app: INestApplication;
  let state: FakeState;

  beforeEach(async () => {
    state = {
      repair_order_reject_causes: [],
      repair_orders: [],
    };

    const fakeKnex = createFakeKnex(state);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [RepairOrderRejectCausesController],
      providers: [
        RepairOrderRejectCausesService,
        {
          provide: getKnexConnectionToken('default'),
          useValue: fakeKnex,
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
            del: jest.fn().mockResolvedValue(undefined),
            flushByPrefix: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: LoggerService,
          useValue: {
            error: jest.fn(),
            log: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAdminAuthGuard)
      .useValue({
        canActivate: (): boolean => true,
      })
      .overrideGuard(PermissionsGuard)
      .useValue({
        canActivate: (): boolean => true,
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  function seedRejectCause(
    overrides: Partial<RepairOrderRejectCause> = {},
  ): RepairOrderRejectCause {
    const row: RepairOrderRejectCause = {
      id: uuidv4(),
      name: 'Default cause',
      description: 'Default description',
      sort: 1,
      is_active: true,
      status: 'Open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };

    state.repair_order_reject_causes.push(row);
    return row;
  }

  it('lists reject causes with pagination metadata and filters', async () => {
    seedRejectCause({ name: 'Too expensive', sort: 2 });
    seedRejectCause({ name: 'No time', sort: 1 });
    seedRejectCause({ name: 'Inactive cause', sort: 3, is_active: false });

    const response = await request(app.getHttpServer())
      .get('/api/v1/repair-order-reject-causes?search=o&is_active=true&limit=5&offset=0')
      .expect(200);

    expect(response.body.meta).toEqual({
      total: 2,
      limit: 5,
      offset: 0,
    });
    expect(response.body.data.map((item: RepairOrderRejectCause) => item.name)).toEqual([
      'No time',
      'Too expensive',
    ]);
  });

  it('returns a single reject cause by id', async () => {
    const cause = seedRejectCause({ name: 'Moved away' });

    const response = await request(app.getHttpServer())
      .get(`/api/v1/repair-order-reject-causes/${cause.id}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: cause.id,
      name: 'Moved away',
      status: 'Open',
    });
  });

  it('creates a reject cause and assigns the next sort order', async () => {
    seedRejectCause({ name: 'Too expensive', sort: 1 });
    seedRejectCause({ name: 'No time', sort: 2 });

    const response = await request(app.getHttpServer())
      .post('/api/v1/repair-order-reject-causes')
      .send({
        name: 'Wrong branch',
        description: 'Customer prefers another branch.',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      id: expect.any(String),
      name: 'Wrong branch',
      description: 'Customer prefers another branch.',
      sort: 3,
      is_active: true,
      status: 'Open',
    });
  });

  it('rejects invalid create payloads at the endpoint boundary', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/repair-order-reject-causes')
      .send({
        name: '',
      })
      .expect(400);
  });

  it('updates reject cause fields', async () => {
    const cause = seedRejectCause({ name: 'Too expensive', description: 'Old description' });

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/repair-order-reject-causes/${cause.id}`)
      .send({
        name: 'Price mismatch',
        description: 'Updated description',
        is_active: false,
      })
      .expect(200);

    expect(response.body).toEqual({ message: 'Reject cause updated successfully' });
    expect(state.repair_order_reject_causes[0]).toMatchObject({
      id: cause.id,
      name: 'Price mismatch',
      description: 'Updated description',
      is_active: false,
    });
  });

  it('reorders reject causes through the sort endpoint', async () => {
    const first = seedRejectCause({ name: 'First', sort: 1 });
    const second = seedRejectCause({ name: 'Second', sort: 2 });
    const third = seedRejectCause({ name: 'Third', sort: 3 });

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/repair-order-reject-causes/${third.id}/sort`)
      .send({ sort: 1 })
      .expect(200);

    expect(response.body).toEqual({ message: 'Reject cause sort updated successfully' });
    expect(
      state.repair_order_reject_causes
        .slice()
        .sort((left, right) => left.sort - right.sort)
        .map((item) => item.id),
    ).toEqual([third.id, first.id, second.id]);
  });

  it('soft deletes reject causes', async () => {
    const cause = seedRejectCause({ name: 'Delete me' });

    const response = await request(app.getHttpServer())
      .delete(`/api/v1/repair-order-reject-causes/${cause.id}`)
      .expect(200);

    expect(response.body).toEqual({ message: 'Reject cause deleted successfully' });
    expect(state.repair_order_reject_causes[0].status).toBe('Deleted');
  });

  it('rejects invalid UUIDs on path parameters', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/repair-order-reject-causes/not-a-uuid')
      .expect(400);
  });
});
