import { RepairOrderTestSetup } from './setup.e2e';

describe('Repair Orders - Security Tests', () => {
  let repairOrderId: string;
  let readOnlyAdminData: any;
  let readOnlyToken: string;

  beforeAll(async () => {
    await RepairOrderTestSetup.setupApplication();

    // Create read-only admin for permission testing
    const readOnlySetup = await RepairOrderTestSetup.createReadOnlyAdmin();
    readOnlyAdminData = readOnlySetup.readOnlyAdminData;
    readOnlyToken = readOnlySetup.readOnlyToken;
  });

  beforeEach(async () => {
    await RepairOrderTestSetup.cleanRepairOrderTables();

    // Create test repair order in branch1 by admin1
    const createDto = await RepairOrderTestSetup.createValidRepairOrderDto();
    const response = await RepairOrderTestSetup.makeRequest()
      .post('/repair-orders')
      .set('Authorization', RepairOrderTestSetup.getAdminAuth())
      .query({
        branch_id: RepairOrderTestSetup.testData.branchData.id,
        status_id: RepairOrderTestSetup.testData.repairStatus.id,
      })
      .send(createDto);
    repairOrderId = response.body.id;
  });

  afterAll(async () => {
    await RepairOrderTestSetup.cleanupApplication();
  });

  describe('Branch-Level Access Control', () => {
    it('should allow admin to access repair orders from their branch', async () => {
      await RepairOrderTestSetup.makeRequest()
        .get(`/repair-orders/${repairOrderId}`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .expect(200);
    });

    it('should deny cross-branch access for regular admins', async () => {
      // Admin2 from branch2 tries to access repair order from branch1
      const response = await RepairOrderTestSetup.makeRequest()
        .get(`/repair-orders/${repairOrderId}`)
        .set('Authorization', RepairOrderTestSetup.getAdmin2Auth());

      expect([403, 404]).toContain(response.status);
    });

    it('should allow super admin to access all branches', async () => {
      await RepairOrderTestSetup.makeRequest()
        .get(`/repair-orders/${repairOrderId}`)
        .set('Authorization', RepairOrderTestSetup.getSuperAdminAuth())
        .expect(200);
    });

    it('should filter list by admin branch', async () => {
      // Create repair order in branch2
      const createDto = await RepairOrderTestSetup.createValidRepairOrderDto();
      await RepairOrderTestSetup.makeRequest()
        .post('/repair-orders')
        .set('Authorization', RepairOrderTestSetup.getAdmin2Auth())
        .query({
          branch_id: RepairOrderTestSetup.testData.branch2Data.id,
          status_id: RepairOrderTestSetup.testData.repairStatus.id,
        })
        .send(createDto);

      // Admin1 should only see branch1 repair orders
      const response1 = await RepairOrderTestSetup.makeRequest()
        .get('/repair-orders')
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({ branch_id: RepairOrderTestSetup.testData.branchData.id })
        .expect(200);

      // Admin2 should only see branch2 repair orders
      const response2 = await RepairOrderTestSetup.makeRequest()
        .get('/repair-orders')
        .set('Authorization', RepairOrderTestSetup.getAdmin2Auth())
        .query({ branch_id: RepairOrderTestSetup.testData.branch2Data.id })
        .expect(200);

      // Each admin should see different repair orders
      const admin1Orders = Object.values(response1.body).flat();
      const admin2Orders = Object.values(response2.body).flat();

      if (admin1Orders.length > 0 && admin2Orders.length > 0) {
        const admin1Ids = admin1Orders.map((order: any) => order.id);
        const admin2Ids = admin2Orders.map((order: any) => order.id);
        expect(admin1Ids).not.toEqual(admin2Ids);
      }
    });

    it('should prevent cross-branch updates', async () => {
      const updateDto = { priority: 'High' };

      const response = await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${repairOrderId}`)
        .set('Authorization', RepairOrderTestSetup.getAdmin2Auth())
        .send(updateDto);

      expect([403, 404]).toContain(response.status);
    });

    it('should prevent cross-branch deletions', async () => {
      const response = await RepairOrderTestSetup.makeRequest()
        .delete(`/repair-orders/${repairOrderId}`)
        .set('Authorization', RepairOrderTestSetup.getAdmin2Auth());

      expect([403, 404]).toContain(response.status);
    });

    it('should prevent cross-branch status moves', async () => {
      const moveDto = { notes: 'Unauthorized move' };

      const response = await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${repairOrderId}/move`)
        .set('Authorization', RepairOrderTestSetup.getAdmin2Auth())
        .query({ status_id: RepairOrderTestSetup.testData.inProgressStatus.id })
        .send(moveDto);

      expect([403, 404]).toContain(response.status);
    });

    it('should validate branch_id in query parameters', async () => {
      // Try to access repair order with wrong branch_id
      const response = await RepairOrderTestSetup.makeRequest()
        .get('/repair-orders')
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({ branch_id: RepairOrderTestSetup.testData.branch2Data.id });

      // Should either return empty or deny access
      expect([200, 403]).toContain(response.status);
      if (response.status === 200) {
        const orders = Object.values(response.body).flat();
        expect(orders.length).toBe(0);
      }
    });
  });

  describe('Permission-Based Access Control', () => {
    it('should allow read operations with repair_orders.read permission', async () => {
      await RepairOrderTestSetup.makeRequest()
        .get(`/repair-orders/${repairOrderId}`)
        .set('Authorization', `Bearer ${readOnlyToken}`)
        .expect(200);

      await RepairOrderTestSetup.makeRequest()
        .get('/repair-orders')
        .set('Authorization', `Bearer ${readOnlyToken}`)
        .query({ branch_id: RepairOrderTestSetup.testData.branchData.id })
        .expect(200);
    });

    it('should deny create operations without repair_orders.create permission', async () => {
      const createDto = await RepairOrderTestSetup.createValidRepairOrderDto();

      const response = await RepairOrderTestSetup.makeRequest()
        .post('/repair-orders')
        .set('Authorization', `Bearer ${readOnlyToken}`)
        .query({
          branch_id: RepairOrderTestSetup.testData.branchData.id,
          status_id: RepairOrderTestSetup.testData.repairStatus.id,
        })
        .send(createDto);

      expect([403, 401]).toContain(response.status);
    });

    it('should deny update operations without repair_orders.update permission', async () => {
      const updateDto = { priority: 'High' };

      const response = await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${repairOrderId}`)
        .set('Authorization', `Bearer ${readOnlyToken}`)
        .send(updateDto);

      expect([403, 401]).toContain(response.status);
    });

    it('should deny delete operations without repair_orders.delete permission', async () => {
      const response = await RepairOrderTestSetup.makeRequest()
        .delete(`/repair-orders/${repairOrderId}`)
        .set('Authorization', `Bearer ${readOnlyToken}`);

      expect([403, 401]).toContain(response.status);
    });

    it('should deny status moves without appropriate permissions', async () => {
      const moveDto = { notes: 'Unauthorized move' };

      const response = await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${repairOrderId}/move`)
        .set('Authorization', `Bearer ${readOnlyToken}`)
        .query({ status_id: RepairOrderTestSetup.testData.inProgressStatus.id })
        .send(moveDto);

      expect([403, 401]).toContain(response.status);
    });

    it('should validate wildcard permissions for super admin', async () => {
      // Super admin should have access to all operations
      const createDto = await RepairOrderTestSetup.createValidRepairOrderDto();

      // Create
      await RepairOrderTestSetup.makeRequest()
        .post('/repair-orders')
        .set('Authorization', RepairOrderTestSetup.getSuperAdminAuth())
        .query({
          branch_id: RepairOrderTestSetup.testData.branchData.id,
          status_id: RepairOrderTestSetup.testData.repairStatus.id,
        })
        .send(createDto)
        .expect(201);

      // Read
      await RepairOrderTestSetup.makeRequest()
        .get(`/repair-orders/${repairOrderId}`)
        .set('Authorization', RepairOrderTestSetup.getSuperAdminAuth())
        .expect(200);

      // Update
      await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${repairOrderId}`)
        .set('Authorization', RepairOrderTestSetup.getSuperAdminAuth())
        .send({ priority: 'High' })
        .expect(200);

      // Status move
      await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${repairOrderId}/move`)
        .set('Authorization', RepairOrderTestSetup.getSuperAdminAuth())
        .query({ status_id: RepairOrderTestSetup.testData.inProgressStatus.id })
        .send({ notes: 'Super admin move' })
        .expect(200);

      // Delete
      await RepairOrderTestSetup.makeRequest()
        .delete(`/repair-orders/${repairOrderId}`)
        .set('Authorization', RepairOrderTestSetup.getSuperAdminAuth())
        .expect(200);
    });
  });

  describe('Authentication Security', () => {
    it('should reject requests without authentication token', async () => {
      await RepairOrderTestSetup.makeRequest().get(`/repair-orders/${repairOrderId}`).expect(401);

      await RepairOrderTestSetup.makeRequest().post('/repair-orders').send({}).expect(401);

      await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${repairOrderId}`)
        .send({})
        .expect(401);

      await RepairOrderTestSetup.makeRequest()
        .delete(`/repair-orders/${repairOrderId}`)
        .expect(401);
    });

    it('should reject requests with invalid authentication token', async () => {
      const invalidToken = 'Bearer invalid-token';

      await RepairOrderTestSetup.makeRequest()
        .get(`/repair-orders/${repairOrderId}`)
        .set('Authorization', invalidToken)
        .expect(401);

      await RepairOrderTestSetup.makeRequest()
        .post('/repair-orders')
        .set('Authorization', invalidToken)
        .send({})
        .expect(401);

      await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${repairOrderId}`)
        .set('Authorization', invalidToken)
        .send({})
        .expect(401);

      await RepairOrderTestSetup.makeRequest()
        .delete(`/repair-orders/${repairOrderId}`)
        .set('Authorization', invalidToken)
        .expect(401);
    });

    it('should reject requests with malformed authentication header', async () => {
      const malformedHeaders = ['invalid-format', 'Bearer', 'Basic token', 'Bearer '];

      for (const header of malformedHeaders) {
        await RepairOrderTestSetup.makeRequest()
          .get(`/repair-orders/${repairOrderId}`)
          .set('Authorization', header)
          .expect(401);
      }
    });

    it('should handle token expiration scenarios', async () => {
      const expiredToken =
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.expired';

      await RepairOrderTestSetup.makeRequest()
        .get(`/repair-orders/${repairOrderId}`)
        .set('Authorization', expiredToken)
        .expect(401);
    });

    it('should handle session invalidation', async () => {
      // Invalidate session in Redis
      await RepairOrderTestSetup.redis.del(
        `session:admin:${RepairOrderTestSetup.testData.adminData.id}`,
      );

      const response = await RepairOrderTestSetup.makeRequest()
        .get(`/repair-orders/${repairOrderId}`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth());

      expect([401, 403]).toContain(response.status);

      // Restore session for other tests
      RepairOrderTestSetup.testData.adminToken = await RepairOrderTestSetup.authenticateAdmin(
        RepairOrderTestSetup.testData.adminData,
      );
    });
  });

  describe('Data Access Security', () => {
    it('should prevent unauthorized access to repair order details', async () => {
      // Create repair order in admin's branch
      const response = await RepairOrderTestSetup.makeRequest()
        .get(`/repair-orders/${repairOrderId}`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .expect(200);

      // Verify response doesn't contain sensitive admin data
      expect(response.body).not.toHaveProperty('password');
      expect(response.body).not.toHaveProperty('admin_secret');

      // Verify user data is properly exposed
      expect(response.body.user).toBeDefined();
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should enforce row-level security for branch isolation', async () => {
      // Create repair order in branch2
      const createDto = await RepairOrderTestSetup.createValidRepairOrderDto();
      const branch2Order = await RepairOrderTestSetup.makeRequest()
        .post('/repair-orders')
        .set('Authorization', RepairOrderTestSetup.getAdmin2Auth())
        .query({
          branch_id: RepairOrderTestSetup.testData.branch2Data.id,
          status_id: RepairOrderTestSetup.testData.repairStatus.id,
        })
        .send(createDto);

      // Admin from branch1 should not see branch2 repair order
      const response = await RepairOrderTestSetup.makeRequest()
        .get(`/repair-orders/${branch2Order.body.id}`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth());

      expect([403, 404]).toContain(response.status);
    });

    it('should validate resource ownership before operations', async () => {
      // Admin2 should not be able to update repair order created by Admin1
      const updateDto = { priority: 'High' };

      const response = await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${repairOrderId}`)
        .set('Authorization', RepairOrderTestSetup.getAdmin2Auth())
        .send(updateDto);

      expect([403, 404]).toContain(response.status);

      // Verify the repair order was not modified
      const dbRecord = await RepairOrderTestSetup.knex('repair_orders')
        .where({ id: repairOrderId })
        .first();
      expect(dbRecord.priority).not.toBe('High');
    });
  });
});
