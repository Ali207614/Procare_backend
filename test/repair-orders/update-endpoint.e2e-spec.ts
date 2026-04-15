import { ForbiddenException, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getKnexConnectionToken } from 'nestjs-knex';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { BranchExistGuard } from '../../src/common/guards/branch-exist.guard';
import { JwtAdminAuthGuard } from '../../src/common/guards/jwt-admin.guard';
import { RepairOrderStatusExistGuard } from '../../src/common/guards/repair-order-status-exist.guard';
import { AdminPayload } from '../../src/common/types/admin-payload.interface';
import { RepairOrder } from '../../src/common/types/repair-order.interface';
import { RepairOrderStatusPermission } from '../../src/common/types/repair-order-status-permssion.interface';
import { RepairOrderChangeLoggerService } from '../../src/repair-orders/services/repair-order-change-logger.service';
import { FinalProblemUpdaterService } from '../../src/repair-orders/services/final-problem-updater.service';
import { InitialProblemUpdaterService } from '../../src/repair-orders/services/initial-problem-updater.service';
import { RepairOrderCreateHelperService } from '../../src/repair-orders/services/repair-order-create-helper.service';
import { RepairOrderWebhookService } from '../../src/repair-orders/services/repair-order-webhook.service';
import { RepairOrdersController } from '../../src/repair-orders/repair-orders.controller';
import { RepairOrdersService } from '../../src/repair-orders/repair-orders.service';
import { RepairOrderStatusPermissionsService } from '../../src/repair-order-status-permission/repair-order-status-permissions.service';
import { NotificationService } from '../../src/notification/notification.service';
import { PdfService } from '../../src/pdf/pdf.service';
import { RedisService } from '../../src/common/redis/redis.service';
import { LoggerService } from '../../src/common/logger/logger.service';

type FakeState = {
  repair_orders: RepairOrder[];
  users: Array<Record<string, unknown>>;
  repair_order_statuses: Array<Record<string, unknown>>;
  repair_order_status_permissions: RepairOrderStatusPermission[];
  repair_order_reject_causes: Array<Record<string, unknown>>;
  'repair-order-status-transitions': Array<Record<string, unknown>>;
  repair_order_rental_phones: Array<Record<string, unknown>>;
};

class FakeQueryBuilder {
  private filters: Array<(row: Record<string, unknown>) => boolean> = [];

  constructor(
    private readonly state: FakeState,
    private readonly table: keyof FakeState,
  ) {}

  where(arg1: string | Record<string, unknown>, arg2?: unknown, arg3?: unknown): this {
    return this.addFilter(arg1, arg2, arg3);
  }

  andWhere(arg1: string | Record<string, unknown>, arg2?: unknown, arg3?: unknown): this {
    return this.addFilter(arg1, arg2, arg3);
  }

  whereIn(column: string, values: unknown[]): this {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  whereNot(criteria: Record<string, unknown>): this {
    this.filters.push((row) => !this.matchesObject(row, criteria));
    return this;
  }

  andWhereNot(criteria: Record<string, unknown>): this {
    return this.whereNot(criteria);
  }

  whereRaw(sql: string, value: string): this {
    if (sql.includes('LOWER(phone_number1) = ?')) {
      this.filters.push((row) => ((row.phone_number1 as string) ?? '').toLowerCase() === value);
    }
    return this;
  }

  select(): this {
    return this;
  }

  first(): Promise<Record<string, unknown> | undefined> {
    return Promise.resolve(this.getRows()[0]);
  }

  async update(data: Record<string, unknown>): Promise<number> {
    const rows = this.getRows();
    rows.forEach((row) => Object.assign(row, data));
    return Promise.resolve(rows.length);
  }

  async increment(field: string, amount: number): Promise<number> {
    const rows = this.getRows();
    rows.forEach((row) => {
      row[field] = Number(row[field] ?? 0) + amount;
    });
    return Promise.resolve(rows.length);
  }

  async decrement(field: string, amount: number): Promise<number> {
    const rows = this.getRows();
    rows.forEach((row) => {
      row[field] = Number(row[field] ?? 0) - amount;
    });
    return Promise.resolve(rows.length);
  }

  insert(data: Record<string, unknown> | Record<string, unknown>[]): {
    returning: (cols: string[] | string) => Promise<unknown[]>;
  } {
    const rows = Array.isArray(data) ? data : [data];
    const inserted = rows.map((row) => ({
      id: row.id ?? uuidv4(),
      ...row,
    }));
    this.state[this.table].push(...(inserted as never[]));

    return {
      returning: async (cols: string[] | string): Promise<unknown[]> => {
        const fields = Array.isArray(cols) ? cols : [cols];
        const result = inserted.map((row) => {
          if (fields.length === 1 && fields[0] === 'id') {
            return { id: row.id };
          }
          return fields.reduce<Record<string, unknown>>((acc, field) => {
            acc[field] = (row as Record<string, unknown>)[field];
            return acc;
          }, {});
        });
        return Promise.resolve(result);
      },
    };
  }

  private addFilter(arg1: string | Record<string, unknown>, arg2?: unknown, arg3?: unknown): this {
    if (typeof arg1 === 'object' && arg1 !== null) {
      this.filters.push((row) => this.matchesObject(row, arg1));
      return this;
    }

    if (typeof arg1 === 'string' && arg3 === undefined) {
      this.filters.push((row) => row[arg1] === arg2);
      return this;
    }

    if (typeof arg1 === 'string') {
      this.filters.push((row) => {
        const value = row[arg1] as number; // Assuming numeric comparisons for > < ops
        switch (arg2) {
          case '>':
            return value > (arg3 as number);
          case '<':
            return value < (arg3 as number);
          case '>=':
            return value >= (arg3 as number);
          case '<=':
            return value <= (arg3 as number);
          default:
            return value === arg3;
        }
      });
    }

    return this;
  }

  private matchesObject(row: Record<string, unknown>, criteria: Record<string, unknown>): boolean {
    return Object.entries(criteria).every(([key, value]) => row[key] === value);
  }

  private getRows(): Record<string, unknown>[] {
    const tableData = this.state[this.table] as Array<Record<string, unknown>>;
    return tableData.filter((row) => this.filters.every((filter) => filter(row)));
  }
}

function createFakeKnex(state: FakeState): unknown {
  const trx = ((table: keyof FakeState) => new FakeQueryBuilder(state, table)) as unknown as {
    commit: jest.Mock;
    rollback: jest.Mock;
  };
  trx.commit = jest.fn().mockResolvedValue(undefined);
  trx.rollback = jest.fn().mockResolvedValue(undefined);

  return {
    transaction: jest.fn().mockResolvedValue(trx),
    raw: jest.fn(),
  };
}

describe('PATCH /api/v1/repair-orders/:repair_order_id', () => {
  let app: INestApplication;
  let service: RepairOrdersService;
  let state: FakeState;
  let permissionService: {
    findByRolesAndBranch: jest.Mock;
    checkPermissionsOrThrow: jest.Mock;
  };

  const admin: AdminPayload = {
    id: 'admin-id',
    phone_number: '+998901234567',
    roles: [{ id: 'role-id', name: 'Repair Admin' }],
  };

  beforeEach(async () => {
    state = {
      repair_orders: [],
      users: [],
      repair_order_statuses: [],
      repair_order_status_permissions: [],
      repair_order_reject_causes: [],
      'repair-order-status-transitions': [],
      repair_order_rental_phones: [],
    };

    permissionService = {
      findByRolesAndBranch: jest.fn(async (_roles, branchId) => {
        const result = state.repair_order_status_permissions.filter(
          (item) => item.branch_id === branchId,
        );
        return Promise.resolve(result);
      }),
      checkPermissionsOrThrow: jest.fn(
        async (
          _roles,
          branchId: string,
          statusId: string,
          requiredFields: Array<keyof RepairOrderStatusPermission>,
        ) => {
          const permission = state.repair_order_status_permissions.find(
            (item) => item.branch_id === branchId && item.status_id === statusId,
          );

          if (!permission) {
            throw new ForbiddenException('Permission not configured');
          }

          for (const field of requiredFields) {
            if (!permission[field]) {
              throw new ForbiddenException(`Missing permission: ${field}`);
            }
          }
          return Promise.resolve();
        },
      ),
    };

    const fakeKnex = createFakeKnex(state);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [RepairOrdersController],
      providers: [
        RepairOrdersService,
        {
          provide: getKnexConnectionToken('default'),
          useValue: fakeKnex,
        },
        {
          provide: RepairOrderStatusPermissionsService,
          useValue: permissionService,
        },
        {
          provide: RepairOrderChangeLoggerService,
          useValue: {
            logMultipleFieldsIfChanged: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: InitialProblemUpdaterService,
          useValue: {
            update: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: FinalProblemUpdaterService,
          useValue: {
            update: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: RepairOrderCreateHelperService,
          useValue: {
            getRepairOrderNotificationMeta: jest.fn().mockResolvedValue({ order_id: 'meta-order' }),
          },
        },
        {
          provide: RedisService,
          useValue: {
            flushByPrefix: jest.fn().mockResolvedValue(undefined),
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
            del: jest.fn().mockResolvedValue(undefined),
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
        {
          provide: PdfService,
          useValue: {},
        },
        {
          provide: RepairOrderWebhookService,
          useValue: {},
        },
        {
          provide: NotificationService,
          useValue: {
            notifyBranch: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    })
      .overrideGuard(JwtAdminAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => { getRequest: () => { admin: AdminPayload } };
        }): boolean => {
          const req = context.switchToHttp().getRequest();
          req.admin = admin;
          return true;
        },
      })
      .overrideGuard(BranchExistGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RepairOrderStatusExistGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api/v1');
    await app.init();

    service = moduleFixture.get(RepairOrdersService);
    const serviceInternal = service as unknown as Record<string, () => Promise<void>>;
    jest.spyOn(serviceInternal, 'notifyRepairOrderUpdate').mockResolvedValue(undefined);
    jest.spyOn(serviceInternal, 'moveToTop').mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  function makePermission(statusId: string, branchId = 'branch-id'): RepairOrderStatusPermission {
    return {
      id: uuidv4(),
      branch_id: branchId,
      status_id: statusId,
      role_id: 'role-id',
      can_add: true,
      can_view: true,
      can_update: true,
      can_delete: true,
      can_payment_add: true,
      can_payment_cancel: true,
      can_assign_admin: true,
      can_notification: true,
      can_notification_bot: false,
      can_change_active: true,
      can_change_status: true,
      can_view_initial_problems: true,
      can_change_initial_problems: true,
      can_view_final_problems: true,
      can_change_final_problems: true,
      can_comment: true,
      can_pickup_manage: true,
      can_delivery_manage: true,
      can_view_payments: true,
      can_manage_rental_phone: true,
      can_view_history: true,
      can_user_manage: true,
      can_create_user: false,
      cannot_continue_without_imei: false,
      cannot_continue_without_reject_cause: false,
      cannot_continue_without_agreed_date: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  function seedOrder(overrides: Partial<RepairOrder> = {}): RepairOrder {
    const order: RepairOrder = {
      id: uuidv4(),
      number_id: 1001,
      user_id: null,
      branch_id: 'branch-id',
      total: '0',
      imei: null,
      phone_category_id: 'phone-category-id',
      status_id: 'status-open',
      delivery_method: 'Self',
      pickup_method: 'Self',
      sort: 1,
      priority: 'Medium',
      priority_level: 2,
      agreed_date: null,
      reject_cause_id: null,
      region_id: null,
      created_by: admin.id,
      status: 'Open',
      phone_number: '+998901111111',
      name: null,
      source: 'Qolda',
      call_count: 0,
      missed_calls: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };

    state.repair_orders.push(order);
    return order;
  }

  it('creates and links a new user from valid full name and phone_number', async () => {
    state.repair_order_status_permissions.push(makePermission('status-open'));
    const order = seedOrder();

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/repair-orders/${order.id}`)
      .send({
        name: 'Alisher Rizayev',
        phone_number: '+998901234567',
      })
      .expect(200);

    expect(response.body).toEqual({ message: 'Repair order updated successfully' });
    expect(state.users).toHaveLength(1);
    expect(state.repair_orders[0].user_id).toBe(state.users[0].id);
    expect(state.repair_orders[0].name).toBe('Alisher Rizayev');
    expect(state.repair_orders[0].phone_number).toBe('+998901234567');
    expect(state.users[0].first_name).toBe('Alisher');
    expect(state.users[0].last_name).toBe('Rizayev');
    expect(state.users[0].phone_number1).toBe('+998901234567');
  });

  it('stores a single-word name as first_name and null last_name', async () => {
    state.repair_order_status_permissions.push(makePermission('status-open'));
    const order = seedOrder();

    await request(app.getHttpServer())
      .patch(`/api/v1/repair-orders/${order.id}`)
      .send({
        name: 'Alisher',
        phone_number: '+998901234568',
      })
      .expect(200);

    expect(state.users).toHaveLength(1);
    expect(state.users[0].first_name).toBe('Alisher');
    expect(state.users[0].last_name).toBeNull();
  });

  it('links an existing user by phone_number instead of creating a duplicate', async () => {
    state.repair_order_status_permissions.push(makePermission('status-open'));
    state.users.push({
      id: 'existing-user-id',
      phone_number1: '+998901234569',
      first_name: 'Existing',
      last_name: 'User',
      status: 'Open',
    });
    const order = seedOrder();

    await request(app.getHttpServer())
      .patch(`/api/v1/repair-orders/${order.id}`)
      .send({
        name: 'Alisher Rizayev',
        phone_number: '+998901234569',
      })
      .expect(200);

    expect(state.users).toHaveLength(1);
    expect(state.repair_orders[0].user_id).toBe('existing-user-id');
  });

  it('updates an existing webhook user with missing name fields instead of creating a duplicate', async () => {
    state.repair_order_status_permissions.push(makePermission('status-open'));
    state.users.push({
      id: 'existing-user-id',
      phone_number1: '+998901234571',
      first_name: null,
      last_name: null,
      status: 'Open',
    });
    const order = seedOrder();

    await request(app.getHttpServer())
      .patch(`/api/v1/repair-orders/${order.id}`)
      .send({
        name: 'Alisher Rizayev',
        phone_number: '+998901234571',
      })
      .expect(200);

    expect(state.users).toHaveLength(1);
    expect(state.repair_orders[0].user_id).toBe('existing-user-id');
    expect(state.users[0].first_name).toBe('Alisher');
    expect(state.users[0].last_name).toBe('Rizayev');
  });

  it('links a user on status change even when target can_create_user is false', async () => {
    const openStatusId = uuidv4();
    const diagnosisStatusId = uuidv4();

    state.repair_order_status_permissions.push(makePermission(openStatusId));
    state.repair_order_status_permissions.push(makePermission(diagnosisStatusId));
    state.repair_order_statuses.push({ id: diagnosisStatusId, status: 'Open', type: 'Open' });
    state['repair-order-status-transitions'].push({
      id: uuidv4(),
      from_status_id: openStatusId,
      to_status_id: diagnosisStatusId,
    });
    const order = seedOrder({
      status_id: openStatusId,
      name: 'Alisher Rizayev',
      phone_number: '+998901234570',
    });

    await request(app.getHttpServer())
      .patch(`/api/v1/repair-orders/${order.id}`)
      .send({
        status_id: diagnosisStatusId,
      })
      .expect(200);

    expect(state.users).toHaveLength(1);
    expect(state.repair_orders[0].status_id).toBe(diagnosisStatusId);
    expect(state.repair_orders[0].user_id).toBe(state.users[0].id);
    expect(state.users[0].first_name).toBe('Alisher');
    expect(state.users[0].last_name).toBe('Rizayev');
  });

  it('keeps the admin-selected status when reject cause is provided', async () => {
    const openStatusId = uuidv4();
    const targetStatusId = uuidv4();
    const invalidStatusId = uuidv4();
    const rejectCauseId = uuidv4();

    const targetPermission = makePermission(targetStatusId);
    targetPermission.cannot_continue_without_reject_cause = true;

    state.repair_order_status_permissions.push(makePermission(openStatusId));
    state.repair_order_status_permissions.push(targetPermission);
    state.repair_order_status_permissions.push(makePermission(invalidStatusId));

    state.repair_order_statuses.push(
      { id: targetStatusId, branch_id: 'branch-id', status: 'Open', type: 'Open', is_active: true },
      {
        id: invalidStatusId,
        branch_id: 'branch-id',
        status: 'Open',
        type: 'Invalid',
        is_active: true,
      },
    );

    state['repair-order-status-transitions'].push(
      {
        id: uuidv4(),
        from_status_id: openStatusId,
        to_status_id: targetStatusId,
      },
      {
        id: uuidv4(),
        from_status_id: openStatusId,
        to_status_id: invalidStatusId,
      },
    );

    state.repair_order_reject_causes.push({
      id: rejectCauseId,
      status: 'Open',
      is_active: true,
    });

    const order = seedOrder({
      status_id: openStatusId,
    });

    await request(app.getHttpServer())
      .patch(`/api/v1/repair-orders/${order.id}`)
      .send({
        status_id: targetStatusId,
        reject_cause_id: rejectCauseId,
      })
      .expect(200);

    expect(state.repair_orders[0].status_id).toBe(targetStatusId);
    expect(state.repair_orders[0].reject_cause_id).toBe(rejectCauseId);
  });

  it('does not auto-move to Invalid when only reject cause is updated', async () => {
    const openStatusId = uuidv4();
    const invalidStatusId = uuidv4();
    const rejectCauseId = uuidv4();

    state.repair_order_status_permissions.push(makePermission(openStatusId));
    state.repair_order_status_permissions.push(makePermission(invalidStatusId));

    state.repair_order_statuses.push({
      id: invalidStatusId,
      branch_id: 'branch-id',
      status: 'Open',
      type: 'Invalid',
      is_active: true,
    });

    state['repair-order-status-transitions'].push({
      id: uuidv4(),
      from_status_id: openStatusId,
      to_status_id: invalidStatusId,
    });

    state.repair_order_reject_causes.push({
      id: rejectCauseId,
      status: 'Open',
      is_active: true,
    });

    const order = seedOrder({
      status_id: openStatusId,
    });

    await request(app.getHttpServer())
      .patch(`/api/v1/repair-orders/${order.id}`)
      .send({
        reject_cause_id: rejectCauseId,
      })
      .expect(200);

    expect(state.repair_orders[0].status_id).toBe(openStatusId);
    expect(state.repair_orders[0].reject_cause_id).toBe(rejectCauseId);
  });

  it('rejects invalid phone_number payloads at the endpoint boundary', async () => {
    state.repair_order_status_permissions.push(makePermission('status-open'));
    const order = seedOrder();

    await request(app.getHttpServer())
      .patch(`/api/v1/repair-orders/${order.id}`)
      .send({
        name: 'Alisher Rizayev',
        phone_number: '901234567',
      })
      .expect(400);

    expect(state.users).toHaveLength(0);
    expect(state.repair_orders[0].user_id).toBeNull();
  });
});
