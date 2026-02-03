import { RepairOrderTestSetup } from './setup.e2e';

describe('Repair Orders - CRUD Operations', () => {
  let repairOrderId: string;

  beforeAll(async () => {
    await RepairOrderTestSetup.setupApplication();
  });

  beforeEach(async () => {
    await RepairOrderTestSetup.cleanRepairOrderTables();
  });

  afterAll(async () => {
    await RepairOrderTestSetup.cleanupApplication();
  });

  describe('POST /repair-orders - Create Repair Order', () => {
    it('should create repair order successfully with valid data', async () => {
      const createDto = await RepairOrderTestSetup.createValidRepairOrderDto();

      const response = await RepairOrderTestSetup.makeRequest()
        .post('/repair-orders')
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({
          branch_id: RepairOrderTestSetup.testData.branchData.id,
          status_id: RepairOrderTestSetup.testData.repairStatus.id,
        })
        .send(createDto)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('number_id');
      expect(response.body.user_id).toBe(createDto.user_id);
      expect(response.body.phone_category_id).toBe(createDto.phone_category_id);
      expect(response.body.priority).toBe(createDto.priority);

      // Verify database record
      const dbRecord = await RepairOrderTestSetup.knex('repair_orders')
        .where({ id: response.body.id })
        .first();
      expect(dbRecord).toBeDefined();
      expect(dbRecord.user_id).toBe(createDto.user_id);
      expect(dbRecord.branch_id).toBe(RepairOrderTestSetup.testData.branchData.id);
      expect(dbRecord.status_id).toBe(RepairOrderTestSetup.testData.repairStatus.id);
      expect(dbRecord.created_by).toBe(RepairOrderTestSetup.testData.adminData.id);
      expect(dbRecord.updated_by).toBe(RepairOrderTestSetup.testData.adminData.id);
      expect(dbRecord.created_at).toBeTruthy();
      expect(dbRecord.updated_at).toBeTruthy();

      // Verify initial problems were created
      const initialProblems = await RepairOrderTestSetup.knex(
        'repair_order_initial_problems',
      ).where({ repair_order_id: response.body.id });
      expect(initialProblems.length).toBe(1);
      expect(initialProblems[0].problem_category_id).toBe(
        RepairOrderTestSetup.testData.problemCategory.id,
      );

      // Verify comments were created
      const comments = await RepairOrderTestSetup.knex('repair_order_comments').where({
        repair_order_id: response.body.id,
      });
      expect(comments.length).toBe(1);
      expect(comments[0].text).toBe('Device has screen damage');

      repairOrderId = response.body.id;
    });

    it('should validate required fields', async () => {
      const invalidDto = {
        // Missing required fields
        priority: 'High',
      };

      const response = await RepairOrderTestSetup.makeRequest()
        .post('/repair-orders')
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({
          branch_id: RepairOrderTestSetup.testData.branchData.id,
          status_id: RepairOrderTestSetup.testData.repairStatus.id,
        })
        .send(invalidDto)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('location');
      expect(Array.isArray(response.body.message)).toBe(true);
    });

    it('should validate UUID formats', async () => {
      const createDto = await RepairOrderTestSetup.createValidRepairOrderDto({
        user_id: 'invalid-uuid',
      });

      await RepairOrderTestSetup.makeRequest()
        .post('/repair-orders')
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({
          branch_id: RepairOrderTestSetup.testData.branchData.id,
          status_id: RepairOrderTestSetup.testData.repairStatus.id,
        })
        .send(createDto)
        .expect(400);
    });

    it('should validate enum values', async () => {
      const createDto = await RepairOrderTestSetup.createValidRepairOrderDto({
        priority: 'InvalidPriority',
      });

      await RepairOrderTestSetup.makeRequest()
        .post('/repair-orders')
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({
          branch_id: RepairOrderTestSetup.testData.branchData.id,
          status_id: RepairOrderTestSetup.testData.repairStatus.id,
        })
        .send(createDto)
        .expect(400);
    });

    it('should reject unauthorized requests', async () => {
      const createDto = await RepairOrderTestSetup.createValidRepairOrderDto();

      await RepairOrderTestSetup.makeRequest().post('/repair-orders').send(createDto).expect(401);
    });

    it('should reject requests with invalid token', async () => {
      const createDto = await RepairOrderTestSetup.createValidRepairOrderDto();

      await RepairOrderTestSetup.makeRequest()
        .post('/repair-orders')
        .set('Authorization', 'Bearer invalid-token')
        .send(createDto)
        .expect(401);
    });
  });

  describe('GET /repair-orders/:id - Get Single Repair Order', () => {
    beforeEach(async () => {
      // Create test repair order
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

    it('should return repair order details', async () => {
      const response = await RepairOrderTestSetup.makeRequest()
        .get(`/repair-orders/${repairOrderId}`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .expect(200);

      expect(response.body).toHaveProperty('id', repairOrderId);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('branch');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('phone_category');
      expect(response.body).toHaveProperty('initial_problems');
      expect(response.body).toHaveProperty('comments');
      expect(response.body.user.id).toBe(RepairOrderTestSetup.testData.userData.id);
      expect(response.body.branch.id).toBe(RepairOrderTestSetup.testData.branchData.id);
      expect(response.body.status.id).toBe(RepairOrderTestSetup.testData.repairStatus.id);
    });

    it('should return 404 for non-existent repair order', async () => {
      const nonExistentId = '12345678-1234-1234-1234-123456789012';

      const response = await RepairOrderTestSetup.makeRequest()
        .get(`/repair-orders/${nonExistentId}`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .expect(404);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('location');
    });

    it('should return 400 for invalid UUID format', async () => {
      await RepairOrderTestSetup.makeRequest()
        .get('/repair-orders/invalid-uuid')
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .expect(400);
    });

    it('should require authentication', async () => {
      await RepairOrderTestSetup.makeRequest().get(`/repair-orders/${repairOrderId}`).expect(401);
    });
  });

  describe('PATCH /repair-orders/:id - Update Repair Order', () => {
    beforeEach(async () => {
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

    it('should update repair order successfully', async () => {
      const updateDto = {
        priority: 'High',
        total: 150000,
        imei: '123456789012345',
      };

      const response = await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${repairOrderId}`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .send(updateDto)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Repair order updated successfully');

      // Verify database update
      const dbRecord = await RepairOrderTestSetup.knex('repair_orders')
        .where({ id: repairOrderId })
        .first();
      expect(dbRecord.priority).toBe(updateDto.priority);
      expect(parseFloat(dbRecord.total)).toBe(updateDto.total);
      expect(dbRecord.imei).toBe(updateDto.imei);
      expect(dbRecord.updated_by).toBe(RepairOrderTestSetup.testData.adminData.id);
      expect(new Date(dbRecord.updated_at)).toBeInstanceOf(Date);
    });

    it('should validate update data types', async () => {
      const invalidDto = {
        total: 'invalid-number',
        priority: 'InvalidPriority',
      };

      await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${repairOrderId}`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .send(invalidDto)
        .expect(400);
    });

    it('should return 404 for non-existent repair order', async () => {
      const nonExistentId = '12345678-1234-1234-1234-123456789012';
      const updateDto = { priority: 'High' };

      await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${nonExistentId}`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .send(updateDto)
        .expect(404);
    });
  });

  describe('GET /repair-orders - List Repair Orders with Pagination', () => {
    beforeEach(async () => {
      // Create multiple test repair orders
      for (let i = 0; i < 5; i++) {
        const createDto = await RepairOrderTestSetup.createValidRepairOrderDto({
          priority: i % 2 === 0 ? 'High' : 'Low',
        });
        await RepairOrderTestSetup.makeRequest()
          .post('/repair-orders')
          .set('Authorization', RepairOrderTestSetup.getAdminAuth())
          .query({
            branch_id: RepairOrderTestSetup.testData.branchData.id,
            status_id: RepairOrderTestSetup.testData.repairStatus.id,
          })
          .send(createDto);
      }
    });

    it('should return paginated repair orders grouped by status', async () => {
      const response = await RepairOrderTestSetup.makeRequest()
        .get('/repair-orders')
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({
          branch_id: RepairOrderTestSetup.testData.branchData.id,
          limit: 3,
          offset: 0,
        })
        .expect(200);

      expect(response.body).toHaveProperty('Waiting');
      expect(Array.isArray(response.body.Waiting)).toBe(true);
      expect(response.body.Waiting.length).toBeLessThanOrEqual(3);

      // Verify each repair order has required fields
      response.body.Waiting.forEach((order: any) => {
        expect(order).toHaveProperty('id');
        expect(order).toHaveProperty('number_id');
        expect(order).toHaveProperty('priority');
        expect(order).toHaveProperty('user');
        expect(order).toHaveProperty('status');
      });
    });

    it('should filter by priority', async () => {
      await RepairOrderTestSetup.makeRequest()
        .get('/repair-orders')
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({
          branch_id: RepairOrderTestSetup.testData.branchData.id,
          priority: 'High',
        })
        .expect(200);
    });

    it('should filter by date range', async () => {
      const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const to = new Date().toISOString();

      await RepairOrderTestSetup.makeRequest()
        .get('/repair-orders')
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({
          branch_id: RepairOrderTestSetup.testData.branchData.id,
          created_from: from,
          created_to: to,
        })
        .expect(200);
    });

    it('should search by user information', async () => {
      await RepairOrderTestSetup.makeRequest()
        .get('/repair-orders')
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({
          branch_id: RepairOrderTestSetup.testData.branchData.id,
          search: RepairOrderTestSetup.testData.userData.first_name,
        })
        .expect(200);
    });

    it('should require branch_id parameter', async () => {
      await RepairOrderTestSetup.makeRequest()
        .get('/repair-orders')
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .expect(400);
    });
  });

  describe('DELETE /repair-orders/:id - Soft Delete Repair Order', () => {
    beforeEach(async () => {
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

    it('should soft delete repair order successfully', async () => {
      const response = await RepairOrderTestSetup.makeRequest()
        .delete(`/repair-orders/${repairOrderId}`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Repair order deleted successfully');

      // Verify soft delete in database
      const dbRecord = await RepairOrderTestSetup.knex('repair_orders')
        .where({ id: repairOrderId })
        .first();
      expect(dbRecord.deleted_at).toBeTruthy();
      expect(dbRecord.updated_by).toBe(RepairOrderTestSetup.testData.adminData.id);

      // Verify repair order is not accessible after deletion
      await RepairOrderTestSetup.makeRequest()
        .get(`/repair-orders/${repairOrderId}`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .expect(404);
    });

    it('should return 404 for already deleted repair order', async () => {
      // Delete first time
      await RepairOrderTestSetup.makeRequest()
        .delete(`/repair-orders/${repairOrderId}`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .expect(200);

      // Try to delete again
      await RepairOrderTestSetup.makeRequest()
        .delete(`/repair-orders/${repairOrderId}`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .expect(404);
    });
  });
});
