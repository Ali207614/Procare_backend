import { RepairOrderTestSetup } from './repair-orders/setup.e2e';
import { RepairOrderStatusWithPermissions } from '../src/common/types/repair-order-status.interface';
import { v4 as uuidv4 } from 'uuid';

describe('Repair Order Statuses - Viewable Metrics', () => {
  beforeAll(async () => {
    await RepairOrderTestSetup.setupApplication();
  });

  beforeEach(async () => {
    await RepairOrderTestSetup.cleanRepairOrderTables();
    // Also clean permissions and statuses to have a fresh start for metrics
    await RepairOrderTestSetup.knex('repair_order_status_permissions').del();
    await RepairOrderTestSetup.knex('repair_order_statuses').del();
  });

  afterAll(async () => {
    await RepairOrderTestSetup.cleanupApplication();
  });

  it('should return viewable statuses with correct total_repair_orders metrics', async () => {
    const knex = RepairOrderTestSetup.knex;
    const branchId = RepairOrderTestSetup.testData.branchData.id;
    const roleId = RepairOrderTestSetup.testData.roleData.id;

    // 1. Create 3 statuses
    const status1 = {
      id: uuidv4(),
      name_uz: 'Status 1',
      name_en: 'Status 1',
      name_ru: 'Status 1',
      bg_color: '#111',
      color: '#fff',
      sort: 1,
      is_active: true,
      status: 'Open',
      branch_id: branchId,
      created_at: new Date(),
      updated_at: new Date(),
    };
    const status2 = { ...status1, id: uuidv4(), name_uz: 'Status 2', sort: 2 };
    const status3 = { ...status1, id: uuidv4(), name_uz: 'Status 3', sort: 3 };

    await knex('repair_order_statuses').insert([status1, status2, status3]);

    // 2. Assign view permissions to the role
    const permissions = [status1, status2, status3].map((s) => ({
      id: uuidv4(),
      branch_id: branchId,
      role_id: roleId,
      status_id: s.id,
      can_view: true,
      can_change_status: true,
      can_update: true,
      can_user_manage: true,
      created_at: new Date(),
      updated_at: new Date(),
    }));
    await knex('repair_order_status_permissions').insert(permissions);

    // 3. Create repair orders
    // Status 1: 2 orders
    // Status 2: 1 order
    // Status 3: 0 orders
    const orders = [
      { id: uuidv4(), branch_id: branchId, status_id: status1.id, phone_number: '+998901111111', delivery_method: 'Self', pickup_method: 'Self', priority: 'Medium' },
      { id: uuidv4(), branch_id: branchId, status_id: status1.id, phone_number: '+998902222222', delivery_method: 'Self', pickup_method: 'Self', priority: 'Medium' },
      { id: uuidv4(), branch_id: branchId, status_id: status2.id, phone_number: '+998903333333', delivery_method: 'Self', pickup_method: 'Self', priority: 'Medium' },
    ];
    await knex('repair_orders').insert(orders);

    // 4. Add a deleted order to Status 2 (should not be counted)
    await knex('repair_orders').insert({
      id: uuidv4(),
      branch_id: branchId,
      status_id: status2.id,
      phone_number: '+998904444444',
      status: 'Deleted',
      delivery_method: 'Self',
      pickup_method: 'Self',
      priority: 'Medium'
    });

    // Flush redis cache to ensure we get fresh results
    await RepairOrderTestSetup.redis.flushall();

    // 5. Make request
    const response = await RepairOrderTestSetup.makeRequest()
      .get('/repair-order-statuses/viewable')
      .set('Authorization', RepairOrderTestSetup.getAdminAuth())
      .query({ branch_id: branchId })
      .expect(200);

    const data = response.body.data;
    expect(data).toHaveLength(3);

    const s1Result = data.find((s: any) => s.id === status1.id);
    const s2Result = data.find((s: any) => s.id === status2.id);
    const s3Result = data.find((s: any) => s.id === status3.id);

    // Verify metrics
    expect(s1Result.metrics).toBeDefined();
    expect(s1Result.metrics.total_repair_orders).toBe(2);

    expect(s2Result.metrics).toBeDefined();
    expect(s2Result.metrics.total_repair_orders).toBe(1); // One active, one deleted

    expect(s3Result.metrics).toBeDefined();
    expect(s3Result.metrics.total_repair_orders).toBe(0);
  });
});
