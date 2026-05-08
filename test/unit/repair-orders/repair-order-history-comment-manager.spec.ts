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
              existing[state.conflictColumn as string] === next[state.conflictColumn as string],
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
  it('formats status changes with actor-aware text and resolved status names', async () => {
    const db = createDbMock({
      admins: [{ id: 'admin-1', first_name: 'Ali', last_name: 'Valiyev' }],
      admin_roles: [{ admin_id: 'admin-1', role_id: 'role-operator' }],
      roles: [{ id: 'role-operator', type: 'Operator', status: 'Open', is_active: true }],
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

    expect(result).toBe(
      `Operator Ali Valiyev buyurtma holatini o'zgartirdi: "Yangi buyurtma (lead)" -> "Diagnostika"`,
    );
  });

  it('ignores unsupported history rows for comment generation', async () => {
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
      field: 'unsupported_action',
      old_value: null,
      new_value: {
        old_branch_id: 'branch-old',
        new_branch_id: 'branch-new',
      },
      created_by: 'admin-1',
      created_at: '2026-04-13T00:00:00.000Z',
    });

    expect(result).toBeNull();
  });

  it('creates exactly one linked history comment with history metadata', async () => {
    const db = createDbMock({
      repair_order_comments: [],
      admins: [{ id: 'admin-1', first_name: 'Super', last_name: 'Admin' }],
      admin_roles: [{ admin_id: 'admin-1', role_id: 'role-operator' }],
      roles: [{ id: 'role-operator', type: 'Operator', status: 'Open', is_active: true }],
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
      field: 'status_id',
      old_value: 'status-0',
      new_value: 'status-1',
      created_by: 'admin-1',
      created_at: '2026-04-13T01:05:00.000Z',
    } as RepairOrderChangeHistory);

    expect(created).toBe(true);
    expect(db.__rows.repair_order_comments).toHaveLength(1);
    expect(db.__rows.repair_order_comments[0]).toEqual(
      expect.objectContaining({
        repair_order_id: 'order-1',
        text: `Operator Super Admin buyurtma holatini o'zgartirdi: "Diagnostika"`,
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

  it('routes initial problem comments through the specialist wording', async () => {
    const db = createDbMock({
      admins: [{ id: 'admin-1', first_name: 'Aziz', last_name: 'Karimov' }],
      admin_roles: [{ admin_id: 'admin-1', role_id: 'role-specialist' }],
      roles: [{ id: 'role-specialist', type: 'Specialist', status: 'Open', is_active: true }],
      problem_categories: [{ id: 'problem-1', name_uz: 'Displey' }],
    });
    const manager = new RepairOrderHistoryCommentManager(db);

    const result = await manager.buildCommentText(db, {
      id: 'history-5',
      repair_order_id: 'order-1',
      field: 'initial_problems',
      old_value: [],
      new_value: [
        { problem_category_id: 'problem-1', price: 120000, estimated_minutes: 30, parts: [] },
      ],
      created_by: 'admin-1',
      created_at: '2026-05-02T07:00:00.000Z',
    });

    expect(result).toBe(
      `Specialist Aziz Karimov diagnostika muammolarini o'zgartirdi: "Displey, 120 000 so'm, 30 daqiqa"`,
    );
  });

  it('routes service form updates through the master wording', async () => {
    const db = createDbMock({
      admins: [{ id: 'admin-1', first_name: 'Bobur', last_name: 'Tursunov' }],
      admin_roles: [{ admin_id: 'admin-1', role_id: 'role-master' }],
      roles: [{ id: 'role-master', type: 'Master', status: 'Open', is_active: true }],
    });
    const manager = new RepairOrderHistoryCommentManager(db);

    const result = await manager.buildCommentText(db, {
      id: 'history-6',
      repair_order_id: 'order-1',
      field: 'service_form_updated',
      old_value: null,
      new_value: { warranty_id: 'SF-A3B9K2' },
      created_by: 'admin-1',
      created_at: '2026-05-02T07:05:00.000Z',
    });

    expect(result).toBe(`Usta Bobur Tursunov servis formasini yangiladi: "SF-A3B9K2"`);
  });

  it('treats the seeded super admin account as a human actor, not the system actor', async () => {
    const db = createDbMock({
      admins: [
        { id: '00000000-0000-4000-8000-000000000000', first_name: 'Super', last_name: 'Admin' },
      ],
      admin_roles: [
        {
          admin_id: '00000000-0000-4000-8000-000000000000',
          role_id: 'role-super-admin',
        },
      ],
      roles: [
        {
          id: 'role-super-admin',
          type: 'SuperAdmin',
          status: 'Open',
          is_active: true,
        },
      ],
      repair_order_statuses: [{ id: 'status-1', name_uz: 'Diagnostika' }],
    });
    const manager = new RepairOrderHistoryCommentManager(db);

    const result = await manager.buildCommentText(db, {
      id: 'history-super-admin-manual',
      repair_order_id: 'order-1',
      field: 'status_id',
      old_value: null,
      new_value: 'status-1',
      created_by: '00000000-0000-4000-8000-000000000000',
      is_system: false,
      created_at: '2026-05-02T07:10:00.000Z',
    });

    expect(result).toBe(`Super admin Super Admin buyurtma holatini o'zgartirdi: "Diagnostika"`);
  });

  it('routes system-authored comments through the system label', async () => {
    const db = createDbMock({
      repair_order_statuses: [{ id: 'status-1', name_uz: 'Diagnostika' }],
    });
    const manager = new RepairOrderHistoryCommentManager(db);

    const result = await manager.buildCommentText(db, {
      id: 'history-7',
      repair_order_id: 'order-1',
      field: 'status_id',
      old_value: null,
      new_value: 'status-1',
      created_by: '00000000-0000-4000-8000-000000000000',
      is_system: true,
      created_at: '2026-05-02T07:10:00.000Z',
    });

    expect(result).toBe(`Tizim buyurtma holatini o'zgartirdi: "Diagnostika"`);
  });
});
