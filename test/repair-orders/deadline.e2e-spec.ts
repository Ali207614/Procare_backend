import { v4 as uuidv4 } from 'uuid';
import { RepairOrderTestSetup } from './setup.e2e';

describe('Repair Orders - Deadline Calculation', () => {
  beforeAll(async () => {
    await RepairOrderTestSetup.setupApplication();
  });

  beforeEach(async () => {
    await RepairOrderTestSetup.cleanRepairOrderTables();
    await RepairOrderTestSetup.knex('repair-order-status-transitions').del();
    await RepairOrderTestSetup.knex('repair_order_status_permissions').del();

    const roleId = RepairOrderTestSetup.testData.roleData.id;
    const branchId = RepairOrderTestSetup.testData.branchData.id;
    const now = new Date();
    const basePermission = {
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
      created_at: now,
      updated_at: now,
    };

    await RepairOrderTestSetup.knex('repair_order_status_permissions').insert([
      {
        id: uuidv4(),
        branch_id: branchId,
        status_id: RepairOrderTestSetup.testData.repairStatus.id,
        role_id: roleId,
        ...basePermission,
      },
      {
        id: uuidv4(),
        branch_id: branchId,
        status_id: RepairOrderTestSetup.testData.inProgressStatus.id,
        role_id: roleId,
        ...basePermission,
      },
    ]);
  });

  afterAll(async () => {
    await RepairOrderTestSetup.cleanupApplication();
  });

  const createOrder = async (
    estimatedMinutes: number[],
    createdAt: string,
    overrides: Record<string, unknown> = {},
  ): Promise<string> => {
    const dto = await RepairOrderTestSetup.createValidRepairOrderDto({
      initial_problems: estimatedMinutes.map((minutes) => ({
        problem_category_id: RepairOrderTestSetup.testData.problemCategory.id,
        price: 100000,
        estimated_minutes: minutes,
        parts: [],
      })),
      ...overrides,
    });

    const response = await RepairOrderTestSetup.makeRequest()
      .post('/repair-orders')
      .set('Authorization', RepairOrderTestSetup.getAdminAuth())
      .query({
        branch_id: RepairOrderTestSetup.testData.branchData.id,
      })
      .send(dto)
      .expect(201);

    await RepairOrderTestSetup.knex('repair_orders')
      .where({ id: response.body.id })
      .update({ created_at: createdAt, updated_at: createdAt });

    return response.body.id as string;
  };

  const fetchStatusOrders = async (
    statusId = RepairOrderTestSetup.testData.repairStatus.id,
  ): Promise<Array<Record<string, unknown>>> => {
    const response = await RepairOrderTestSetup.makeRequest()
      .get('/repair-orders')
      .set('Authorization', RepairOrderTestSetup.getAdminAuth())
      .query({
        branch_id: RepairOrderTestSetup.testData.branchData.id,
        limit: 20,
        offset: 0,
      })
      .expect(200);

    return (response.body[statusId] ?? []) as Array<Record<string, unknown>>;
  };

  const diffMinutes = (from: string, to: string): number =>
    Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000);

  const expectMinutesWithin = (actual: number, expected: number): void => {
    expect(actual).toBeGreaterThanOrEqual(expected - 1);
    expect(actual).toBeLessThanOrEqual(expected + 1);
  };

  it('returns deadline_at based on remaining queue time in sort order', async () => {
    const now = Date.now();

    const oldestId = await createOrder([60], new Date(now - 20 * 60000).toISOString());
    const middleId = await createOrder([30, 30], new Date(now - 10 * 60000).toISOString());
    const newestId = await createOrder([15], new Date(now - 5 * 60000).toISOString());

    await RepairOrderTestSetup.makeRequest()
      .patch(`/repair-orders/${oldestId}/sort`)
      .set('Authorization', RepairOrderTestSetup.getAdminAuth())
      .send({ sort: 1 })
      .expect(200);

    await RepairOrderTestSetup.makeRequest()
      .patch(`/repair-orders/${middleId}/sort`)
      .set('Authorization', RepairOrderTestSetup.getAdminAuth())
      .send({ sort: 2 })
      .expect(200);

    await RepairOrderTestSetup.makeRequest()
      .patch(`/repair-orders/${newestId}/sort`)
      .set('Authorization', RepairOrderTestSetup.getAdminAuth())
      .send({ sort: 3 })
      .expect(200);

    const orders = await fetchStatusOrders();
    const byId = new Map(orders.map((order) => [order.id as string, order]));

    const first = byId.get(oldestId);
    const second = byId.get(middleId);
    const third = byId.get(newestId);

    expect(first?.deadline_at).toBeTruthy();
    expect(second?.deadline_at).toBeTruthy();
    expect(third?.deadline_at).toBeTruthy();

    expectMinutesWithin(diffMinutes(first?.created_at as string, first?.deadline_at as string), 40);
    expectMinutesWithin(diffMinutes(second?.created_at as string, second?.deadline_at as string), 90);
    expectMinutesWithin(diffMinutes(third?.created_at as string, third?.deadline_at as string), 110);
  });

  it('recomputes deadline_at after sort changes and ignores completed elapsed work', async () => {
    const now = Date.now();

    const firstId = await createOrder([30], new Date(now - 120 * 60000).toISOString());
    const secondId = await createOrder([60], new Date(now - 10 * 60000).toISOString());
    const thirdId = await createOrder([], new Date(now - 5 * 60000).toISOString());

    await RepairOrderTestSetup.makeRequest()
      .patch(`/repair-orders/${firstId}/sort`)
      .set('Authorization', RepairOrderTestSetup.getAdminAuth())
      .send({ sort: 1 })
      .expect(200);

    await RepairOrderTestSetup.makeRequest()
      .patch(`/repair-orders/${secondId}/sort`)
      .set('Authorization', RepairOrderTestSetup.getAdminAuth())
      .send({ sort: 2 })
      .expect(200);

    await RepairOrderTestSetup.makeRequest()
      .patch(`/repair-orders/${thirdId}/sort`)
      .set('Authorization', RepairOrderTestSetup.getAdminAuth())
      .send({ sort: 3 })
      .expect(200);

    const beforeOrders = await fetchStatusOrders();
    const beforeById = new Map(beforeOrders.map((order) => [order.id as string, order]));

    expectMinutesWithin(
      diffMinutes(
        beforeById.get(secondId)?.created_at as string,
        beforeById.get(secondId)?.deadline_at as string,
      ),
      50,
    );
    expectMinutesWithin(
      diffMinutes(
        beforeById.get(thirdId)?.created_at as string,
        beforeById.get(thirdId)?.deadline_at as string,
      ),
      55,
    );

    await RepairOrderTestSetup.makeRequest()
      .patch(`/repair-orders/${secondId}/sort`)
      .set('Authorization', RepairOrderTestSetup.getAdminAuth())
      .send({ sort: 1 })
      .expect(200);

    const afterOrders = await fetchStatusOrders();
    const afterById = new Map(afterOrders.map((order) => [order.id as string, order]));

    expectMinutesWithin(
      diffMinutes(
        afterById.get(secondId)?.created_at as string,
        afterById.get(secondId)?.deadline_at as string,
      ),
      50,
    );
    expectMinutesWithin(
      diffMinutes(
        afterById.get(firstId)?.created_at as string,
        afterById.get(firstId)?.deadline_at as string,
      ),
      0,
    );
    expectMinutesWithin(
      diffMinutes(
        afterById.get(thirdId)?.created_at as string,
        afterById.get(thirdId)?.deadline_at as string,
      ),
      55,
    );
  });

  it('recomputes deadlines when an order moves to another status queue', async () => {
    const now = Date.now();

    const waitingId = await createOrder([45], new Date(now - 5 * 60000).toISOString());
    const moveId = await createOrder([30], new Date(now - 10 * 60000).toISOString());

    await RepairOrderTestSetup.knex('repair-order-status-transitions').insert({
      id: uuidv4(),
      from_status_id: RepairOrderTestSetup.testData.repairStatus.id,
      to_status_id: RepairOrderTestSetup.testData.inProgressStatus.id,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const beforeWaiting = await fetchStatusOrders();
    const beforeWaitingById = new Map(beforeWaiting.map((order) => [order.id as string, order]));

    expectMinutesWithin(
      diffMinutes(
        beforeWaitingById.get(waitingId)?.created_at as string,
        beforeWaitingById.get(waitingId)?.deadline_at as string,
      ),
      60,
    );

    await RepairOrderTestSetup.makeRequest()
      .patch(`/repair-orders/${moveId}/move`)
      .set('Authorization', RepairOrderTestSetup.getAdminAuth())
      .send({ status_id: RepairOrderTestSetup.testData.inProgressStatus.id, sort: 1 })
      .expect(200);

    const waitingAfter = await fetchStatusOrders();
    const waitingAfterById = new Map(waitingAfter.map((order) => [order.id as string, order]));
    const inProgressAfter = await fetchStatusOrders(RepairOrderTestSetup.testData.inProgressStatus.id);
    const inProgressById = new Map(inProgressAfter.map((order) => [order.id as string, order]));

    expect(waitingAfterById.has(moveId)).toBe(false);
    expectMinutesWithin(
      diffMinutes(
        waitingAfterById.get(waitingId)?.created_at as string,
        waitingAfterById.get(waitingId)?.deadline_at as string,
      ),
      40,
    );
    expectMinutesWithin(
      diffMinutes(
        inProgressById.get(moveId)?.created_at as string,
        inProgressById.get(moveId)?.deadline_at as string,
      ),
      20,
    );
  });
});
