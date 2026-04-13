import { RepairOrderHistoryCommentManager } from 'src/repair-orders/utils/repair-order-history-comment-manager';
import { RepairOrderChangeHistory } from 'src/common/types/repair-order-change-history.interface';

type TableRows = Record<string, Array<Record<string, any>>>;

function createDbMock(initialRows: TableRows) {
  const rows: TableRows = Object.fromEntries(
    Object.entries(initialRows).map(([table, value]) => [table, [...value]]),
  );

  const db: any = ((table: string) => createBuilder(table)) as any;

  db.transaction = async (callback: (trx: any) => Promise<unknown>) => callback(db);
  db.__rows = rows;

  function createBuilder(table: string) {
    const state: {
      filters: Array<(row: Record<string, any>) => boolean>;
      orders: Array<{ column: string; direction: 'asc' | 'desc' }>;
      insertPayload: Record<string, any> | Record<string, any>[] | null;
      conflictColumn: string | null;
    } = {
      filters: [],
      orders: [],
      insertPayload: null,
      conflictColumn: null,
    };

    const builder: any = {
      where(arg1: unknown, arg2?: unknown, arg3?: unknown) {
        state.filters.push(buildFilter(arg1, arg2, arg3));
        return builder;
      },
      andWhere(arg1: unknown, arg2?: unknown, arg3?: unknown) {
        state.filters.push(buildFilter(arg1, arg2, arg3));
        return builder;
      },
      whereIn(column: string, values: unknown[]) {
        const key = getColumn(column);
        state.filters.push((row) => values.includes(row[key]));
        return builder;
      },
      orderBy(column: string, direction: 'asc' | 'desc' = 'asc') {
        state.orders.push({ column: getColumn(column), direction });
        return builder;
      },
      async first(...columns: string[]) {
        const row = getRows()[0];
        return selectColumns(row, columns);
      },
      async select(...columns: string[]) {
        return getRows().map((row) => selectColumns(row, columns));
      },
      insert(payload: Record<string, any> | Record<string, any>[]) {
        state.insertPayload = payload;
        return builder;
      },
      async returning(...columns: string[]) {
        const inserted = persistInsert();
        return inserted.map((row) => selectColumns(row, columns));
      },
      onConflict(column: string) {
        state.conflictColumn = column;
        return builder;
      },
      async ignore() {
        persistInsert(true);
        return [];
      },
    };

    function getRows() {
      let result = [...(rows[table] ?? [])];

      for (const filter of state.filters) {
        result = result.filter(filter);
      }

      for (const order of state.orders) {
        result.sort((left, right) => {
          const leftValue = left[order.column];
          const rightValue = right[order.column];

          if (leftValue === rightValue) return 0;
          if (order.direction === 'desc') {
            return leftValue > rightValue ? -1 : 1;
          }
          return leftValue > rightValue ? 1 : -1;
        });
      }

      return result;
    }

    function persistInsert(ignoreConflicts = false) {
      const payloads = Array.isArray(state.insertPayload)
        ? state.insertPayload
        : state.insertPayload
          ? [state.insertPayload]
          : [];

      const created = payloads.reduce<Array<Record<string, any>>>((acc, payload, index) => {
        const next = {
          id: payload.id ?? `${table}-generated-${index + 1}`,
          ...payload,
        };

        if (
          ignoreConflicts &&
          state.conflictColumn &&
          next[state.conflictColumn] != null &&
          (rows[table] ?? []).some(
            (existing) =>
              existing[state.conflictColumn as string] ===
              next[state.conflictColumn as string],
          )
        ) {
          return acc;
        }

        rows[table] = rows[table] ?? [];
        rows[table].push(next);
        acc.push(next);
        return acc;
      }, []);

      state.insertPayload = null;
      return created;
    }

    return builder;
  }

  function buildFilter(arg1: unknown, arg2?: unknown, arg3?: unknown) {
    if (typeof arg1 === 'object' && arg1 !== null) {
      const expected = arg1 as Record<string, unknown>;
      return (row: Record<string, any>) =>
        Object.entries(expected).every(([key, value]) => row[getColumn(key)] === value);
    }

    const column = getColumn(String(arg1));
    if (arg3 === undefined) {
      return (row: Record<string, any>) => row[column] === arg2;
    }

    if (arg2 === '<=') {
      return (row: Record<string, any>) => row[column] <= (arg3 as any);
    }

    if (arg2 === '>') {
      return (row: Record<string, any>) => row[column] > (arg3 as any);
    }

    return (row: Record<string, any>) => row[column] === arg3;
  }

  function getColumn(column: string) {
    return column.split('.').pop() ?? column;
  }

  function selectColumns(row: Record<string, any> | undefined, columns: string[]) {
    if (!row) return undefined;
    if (!columns.length || columns.includes('*')) return row;

    return columns.reduce<Record<string, any>>((acc, column) => {
      acc[getColumn(column)] = row[getColumn(column)];
      return acc;
    }, {});
  }

  return db;
}

describe('RepairOrderHistoryCommentManager', () => {
  it('formats status changes in Uzbek using resolved status names', async () => {
    const db = createDbMock({
      repair_order_statuses: [
        { id: 'status-old', name_uz: 'Yangi buyurtma (lead)' },
        { id: 'status-new', name_uz: 'Diagnostika' },
      ],
    });
    const manager = new RepairOrderHistoryCommentManager(db);

    const result = await manager.buildCommentText(db, {
      id: 'history-1',
      repair_order_id: 'order-1',
      field: 'status_id',
      old_value: 'status-old',
      new_value: 'status-new',
      created_by: 'admin-1',
      created_at: '2026-04-13T00:00:00.000Z',
    });

    expect(result).toBe(`Holat o'zgardi: "Yangi buyurtma (lead)" -> "Diagnostika"`);
  });

  it('formats legacy branch transfer rows without exposing raw ids', async () => {
    const db = createDbMock({
      branches: [
        { id: 'branch-old', name_uz: 'Chilonzor' },
        { id: 'branch-new', name_uz: 'Yunusobod' },
      ],
    });
    const manager = new RepairOrderHistoryCommentManager(db);

    const result = await manager.buildCommentText(db, {
      id: 'history-2',
      repair_order_id: 'order-1',
      field: 'branch_transferred',
      old_value: null,
      new_value: {
        old_branch_id: 'branch-old',
        new_branch_id: 'branch-new',
      },
      created_by: 'admin-1',
      created_at: '2026-04-13T00:00:00.000Z',
    });

    expect(result).toBe(`Filial o'zgardi: "Chilonzor" -> "Yunusobod"`);
  });

  it('includes repair order parts when formatting problem history changes', async () => {
    const db = createDbMock({
      problem_categories: [{ id: 'problem-1', name_uz: 'Ekran' }],
      repair_parts: [{ id: 'part-1', part_name_uz: 'Batareya' }],
    });
    const manager = new RepairOrderHistoryCommentManager(db);

    const result = await manager.buildCommentText(db, {
      id: 'history-parts-in-problem',
      repair_order_id: 'order-1',
      field: 'initial_problems',
      old_value: [
        {
          problem_category_id: 'problem-1',
          price: 120,
          estimated_minutes: 45,
          parts: [],
        },
      ],
      new_value: [
        {
          problem_category_id: 'problem-1',
          price: 120,
          estimated_minutes: 45,
          parts: [
            {
              repair_part_id: 'part-1',
              quantity: 1,
              part_price: 50,
            },
          ],
        },
      ],
      created_by: 'admin-1',
      created_at: '2026-04-13T00:00:00.000Z',
    } as RepairOrderChangeHistory);

    expect(result).toBe(
      `Boshlang'ich muammolar o'zgardi: "Ekran, 120 so'm, 45 daqiqa" -> "Ekran, 120 so'm, 45 daqiqa, Qismlar: Batareya, 1 dona, 50 so'm"`,
    );
  });

  it('formats direct repair_order_parts history rows with resolved part names', async () => {
    const db = createDbMock({
      repair_parts: [{ id: 'part-1', part_name_uz: 'Batareya' }],
    });
    const manager = new RepairOrderHistoryCommentManager(db);

    const result = await manager.buildCommentText(db, {
      id: 'history-parts-direct',
      repair_order_id: 'order-1',
      field: 'repair_order_parts',
      old_value: [],
      new_value: [
        {
          repair_part_id: 'part-1',
          quantity: 2,
          part_price: 50,
        },
      ],
      created_by: 'admin-1',
      created_at: '2026-04-13T00:00:00.000Z',
    } as RepairOrderChangeHistory);

    expect(result).toBe(`Ehtiyot qismlar qo'shildi: "Batareya, 2 dona, 50 so'm"`);
  });

  it('creates exactly one linked history comment with history metadata', async () => {
    const db = createDbMock({
      repair_order_comments: [],
      admins: [{ id: 'admin-1', first_name: 'Super', last_name: 'Admin' }],
      repair_order_statuses: [{ id: 'status-1', name_uz: 'Diagnostika' }],
      repair_order_change_histories: [
        {
          id: 'status-history',
          repair_order_id: 'order-1',
          field: 'status_id',
          old_value: 'status-0',
          new_value: 'status-1',
          created_by: 'admin-1',
          created_at: '2026-04-13T01:00:00.000Z',
        },
      ],
      repair_orders: [{ id: 'order-1', status_id: 'status-1' }],
    });
    const manager = new RepairOrderHistoryCommentManager(db);

    const created = await manager.ensureCommentForHistory(db, {
      id: 'history-3',
      repair_order_id: 'order-1',
      field: 'attachment_uploaded',
      old_value: null,
      new_value: { file_name: 'invoice.pdf' },
      created_by: 'admin-1',
      created_at: '2026-04-13T01:05:00.000Z',
    } as RepairOrderChangeHistory);

    expect(created).toBe(true);
    expect(db.__rows.repair_order_comments).toHaveLength(1);
    expect(db.__rows.repair_order_comments[0]).toEqual(
      expect.objectContaining({
        repair_order_id: 'order-1',
        text: 'Fayl qo\'shildi: "invoice.pdf"',
        comment_type: 'history',
        history_change_id: 'history-3',
        created_by: 'admin-1',
        status_by: 'status-1',
      }),
    );
  });

  it('does not create duplicate history comments when the link already exists', async () => {
    const db = createDbMock({
      repair_order_comments: [{ id: 'comment-1', history_change_id: 'history-4' }],
      admins: [{ id: 'admin-1', first_name: 'Super', last_name: 'Admin' }],
      repair_order_statuses: [{ id: 'status-1', name_uz: 'Diagnostika' }],
      repair_order_change_histories: [],
      repair_orders: [{ id: 'order-1', status_id: 'status-1' }],
    });
    const manager = new RepairOrderHistoryCommentManager(db);

    const created = await manager.ensureCommentForHistory(db, {
      id: 'history-4',
      repair_order_id: 'order-1',
      field: 'attachment_deleted',
      old_value: null,
      new_value: { file_name: 'invoice.pdf' },
      created_by: 'admin-1',
      created_at: '2026-04-13T01:05:00.000Z',
    } as RepairOrderChangeHistory);

    expect(created).toBe(false);
    expect(db.__rows.repair_order_comments).toHaveLength(1);
  });

  it('formats legacy product update actions for startup backfill support', async () => {
    const db = createDbMock({
      phone_categories: [{ id: 'category-1', name_uz: 'iPhone 15 Pro' }],
    });
    const manager = new RepairOrderHistoryCommentManager(db);

    const result = await manager.buildCommentText(db, {
      id: 'history-5',
      repair_order_id: 'order-1',
      field: 'product_updated',
      old_value: null,
      new_value: {
        phone_category_id: 'category-1',
        imei: '123456789012345',
      },
      created_by: 'admin-1',
      created_at: '2026-04-13T01:05:00.000Z',
    } as RepairOrderChangeHistory);

    expect(result).toBe(
      `Qurilma ma'lumoti yangilandi: model "iPhone 15 Pro", IMEI "123456789012345"`,
    );
  });
});
