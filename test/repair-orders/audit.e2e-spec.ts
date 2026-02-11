import { RepairOrderTestSetup } from './setup.e2e';

describe('Repair Orders - Audit and Data Integrity', () => {
  let repairOrderId: string;

  beforeAll(async () => {
    await RepairOrderTestSetup.setupApplication();
  });

  beforeEach(async () => {
    await RepairOrderTestSetup.cleanRepairOrderTables();

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

  afterAll(async () => {
    await RepairOrderTestSetup.cleanupApplication();
  });

  describe('Audit Trail Maintenance', () => {
    it('should maintain audit trail for all operations', async () => {
      // Perform various operations
      await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${repairOrderId}`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .send({ priority: 'High' });

      await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${repairOrderId}/move`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({ status_id: RepairOrderTestSetup.testData.inProgressStatus.id })
        .send({ notes: 'Test move' });

      await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${repairOrderId}`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .send({ total: 250000 });

      // Check audit trail
      const historyRecords = await RepairOrderTestSetup.knex('repair_order_history')
        .where({ repair_order_id: repairOrderId })
        .orderBy('created_at', 'asc');

      expect(historyRecords.length).toBeGreaterThan(0);
      historyRecords.forEach((record) => {
        expect(record).toHaveProperty('repair_order_id', repairOrderId);
        expect(record).toHaveProperty('changed_by', RepairOrderTestSetup.testData.adminData.id);
        expect(record).toHaveProperty('field_name');
        expect(record).toHaveProperty('old_value');
        expect(record).toHaveProperty('new_value');
        expect(record.created_at).toBeTruthy();
      });

      // Verify specific changes are tracked
      const priorityChange = historyRecords.find((r) => r.field_name === 'priority');
      const statusChange = historyRecords.find((r) => r.field_name === 'status_id');
      const totalChange = historyRecords.find((r) => r.field_name === 'total');

      expect(priorityChange).toBeDefined();
      expect(statusChange).toBeDefined();
      expect(totalChange).toBeDefined();
    });

    it('should track who made changes with proper admin attribution', async () => {
      // Make change with admin1
      await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${repairOrderId}`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .send({ priority: 'High' });

      // Make change with super admin
      await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${repairOrderId}/move`)
        .set('Authorization', RepairOrderTestSetup.getSuperAdminAuth())
        .query({ status_id: RepairOrderTestSetup.testData.inProgressStatus.id })
        .send({ notes: 'Super admin move' });

      const historyRecords = await RepairOrderTestSetup.knex('repair_order_history')
        .where({ repair_order_id: repairOrderId })
        .orderBy('created_at', 'asc');

      const priorityChange = historyRecords.find((r) => r.field_name === 'priority');
      const statusChange = historyRecords.find((r) => r.field_name === 'status_id');

      expect(priorityChange.changed_by).toBe(RepairOrderTestSetup.testData.adminData.id);
      expect(statusChange.changed_by).toBe(RepairOrderTestSetup.testData.superAdminData.id);
    });

    it('should maintain chronological order of changes', async () => {
      const changes = [
        { field: 'priority', value: 'High' },
        { field: 'imei', value: '123456789012345' },
        { field: 'total', value: 300000 },
      ];

      const timestamps = [];

      for (const change of changes) {
        const startTime = new Date();
        await RepairOrderTestSetup.makeRequest()
          .patch(`/repair-orders/${repairOrderId}`)
          .set('Authorization', RepairOrderTestSetup.getAdminAuth())
          .send({ [change.field]: change.value });
        timestamps.push(startTime);

        // Small delay to ensure different timestamps
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const historyRecords = await RepairOrderTestSetup.knex('repair_order_history')
        .where({ repair_order_id: repairOrderId })
        .orderBy('created_at', 'asc');

      // Verify chronological order
      for (let i = 1; i < historyRecords.length; i++) {
        const prevTime = new Date(historyRecords[i - 1].created_at);
        const currTime = new Date(historyRecords[i].created_at);
        expect(currTime.getTime()).toBeGreaterThanOrEqual(prevTime.getTime());
      }
    });

    it('should preserve history even after soft deletion', async () => {
      // Make some changes
      await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${repairOrderId}`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .send({ priority: 'Critical' });

      await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${repairOrderId}/move`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({ status_id: RepairOrderTestSetup.testData.inProgressStatus.id })
        .send({ notes: 'Work started' });

      // Soft delete
      await RepairOrderTestSetup.makeRequest()
        .delete(`/repair-orders/${repairOrderId}`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth());

      // Verify history is still accessible
      const historyRecords = await RepairOrderTestSetup.knex('repair_order_history').where({
        repair_order_id: repairOrderId,
      });

      expect(historyRecords.length).toBeGreaterThan(0);

      // Verify the soft delete event is also tracked
      const deleteRecord = historyRecords.find((r) => r.field_name === 'deleted_at');
      expect(deleteRecord).toBeDefined();
      expect(deleteRecord.old_value).toBeNull();
      expect(deleteRecord.new_value).toBeTruthy();
    });
  });

  describe('Audit Field Management', () => {
    it('should populate audit fields correctly on create', async () => {
      const dbRecord = await RepairOrderTestSetup.knex('repair_orders')
        .where({ id: repairOrderId })
        .first();

      expect(dbRecord.created_by).toBe(RepairOrderTestSetup.testData.adminData.id);
      expect(dbRecord.updated_by).toBe(RepairOrderTestSetup.testData.adminData.id);
      expect(dbRecord.created_at).toBeTruthy();
      expect(dbRecord.updated_at).toBeTruthy();
      expect(dbRecord.deleted_at).toBeNull();

      // Verify timestamps are recent
      const now = new Date();
      const createdAt = new Date(dbRecord.created_at);
      const updatedAt = new Date(dbRecord.updated_at);

      expect(now.getTime() - createdAt.getTime()).toBeLessThan(5000); // Within 5 seconds
      expect(now.getTime() - updatedAt.getTime()).toBeLessThan(5000); // Within 5 seconds
    });

    it('should update audit fields on modifications', async () => {
      const originalRecord = await RepairOrderTestSetup.knex('repair_orders')
        .where({ id: repairOrderId })
        .first();

      // Wait a moment to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${repairOrderId}`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .send({ priority: 'High' });

      const updatedRecord = await RepairOrderTestSetup.knex('repair_orders')
        .where({ id: repairOrderId })
        .first();

      expect(updatedRecord.updated_by).toBe(RepairOrderTestSetup.testData.adminData.id);
      expect(new Date(updatedRecord.updated_at)).toBeInstanceOf(Date);
      expect(new Date(updatedRecord.updated_at).getTime()).toBeGreaterThan(
        new Date(originalRecord.updated_at).getTime(),
      );

      // created_by and created_at should remain unchanged
      expect(updatedRecord.created_by).toBe(originalRecord.created_by);
      expect(updatedRecord.created_at).toBe(originalRecord.created_at);
    });

    it('should update audit fields on status moves', async () => {
      const originalRecord = await RepairOrderTestSetup.knex('repair_orders')
        .where({ id: repairOrderId })
        .first();

      await new Promise((resolve) => setTimeout(resolve, 10));

      await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${repairOrderId}/move`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({ status_id: RepairOrderTestSetup.testData.inProgressStatus.id })
        .send({ notes: 'Status move' });

      const updatedRecord = await RepairOrderTestSetup.knex('repair_orders')
        .where({ id: repairOrderId })
        .first();

      expect(updatedRecord.updated_by).toBe(RepairOrderTestSetup.testData.adminData.id);
      expect(new Date(updatedRecord.updated_at).getTime()).toBeGreaterThan(
        new Date(originalRecord.updated_at).getTime(),
      );
    });

    it('should set deleted_at on soft deletion', async () => {
      const beforeDelete = new Date();

      await RepairOrderTestSetup.makeRequest()
        .delete(`/repair-orders/${repairOrderId}`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth());

      const afterDelete = new Date();

      const deletedRecord = await RepairOrderTestSetup.knex('repair_orders')
        .where({ id: repairOrderId })
        .first();

      expect(deletedRecord.deleted_at).toBeTruthy();
      expect(deletedRecord.updated_by).toBe(RepairOrderTestSetup.testData.adminData.id);

      const deletedAt = new Date(deletedRecord.deleted_at);
      expect(deletedAt.getTime()).toBeGreaterThanOrEqual(beforeDelete.getTime());
      expect(deletedAt.getTime()).toBeLessThanOrEqual(afterDelete.getTime());
    });
  });

  describe('Referential Integrity', () => {
    it('should maintain referential integrity across all relationships', async () => {
      // Verify foreign key relationships exist and are valid
      const repairOrder = await RepairOrderTestSetup.knex('repair_orders')
        .leftJoin('users', 'repair_orders.user_id', 'users.id')
        .leftJoin('branches', 'repair_orders.branch_id', 'branches.id')
        .leftJoin('phone_categories', 'repair_orders.phone_category_id', 'phone_categories.id')
        .leftJoin('repair_statuses', 'repair_orders.status_id', 'repair_statuses.id')
        .leftJoin('admins as creators', 'repair_orders.created_by', 'creators.id')
        .leftJoin('admins as updaters', 'repair_orders.updated_by', 'updaters.id')
        .select(
          'repair_orders.*',
          'users.first_name as user_first_name',
          'branches.name_en as branch_name',
          'phone_categories.name_en as category_name',
          'repair_statuses.name_en as status_name',
          'creators.first_name as creator_name',
          'updaters.first_name as updater_name',
        )
        .where('repair_orders.id', repairOrderId)
        .first();

      expect(repairOrder).toBeDefined();
      expect(repairOrder.user_first_name).toBeTruthy();
      expect(repairOrder.branch_name).toBeTruthy();
      expect(repairOrder.category_name).toBeTruthy();
      expect(repairOrder.status_name).toBeTruthy();
      expect(repairOrder.creator_name).toBeTruthy();
      expect(repairOrder.updater_name).toBeTruthy();
    });

    it('should maintain integrity of related entities', async () => {
      // Verify initial problems integrity
      const initialProblems = await RepairOrderTestSetup.knex('repair_order_initial_problems')
        .leftJoin(
          'problem_categories',
          'repair_order_initial_problems.problem_category_id',
          'problem_categories.id',
        )
        .select('repair_order_initial_problems.*', 'problem_categories.name_en as category_name')
        .where('repair_order_initial_problems.repair_order_id', repairOrderId);

      expect(initialProblems.length).toBeGreaterThan(0);
      initialProblems.forEach((problem) => {
        expect(problem.category_name).toBeTruthy();
        expect(problem.price).toBeGreaterThanOrEqual(0);
        expect(problem.estimated_minutes).toBeGreaterThanOrEqual(0);
      });

      // Verify comments integrity
      const comments = await RepairOrderTestSetup.knex('repair_order_comments')
        .leftJoin('admins', 'repair_order_comments.created_by', 'admins.id')
        .select('repair_order_comments.*', 'admins.first_name as admin_name')
        .where('repair_order_comments.repair_order_id', repairOrderId);

      expect(comments.length).toBeGreaterThan(0);
      comments.forEach((comment) => {
        expect(comment.admin_name).toBeTruthy();
        expect(comment.text).toBeTruthy();
      });
    });

    it('should prevent orphaned records', async () => {
      // Check for orphaned repair_order_initial_problems
      const orphanedProblems = await RepairOrderTestSetup.knex('repair_order_initial_problems')
        .leftJoin(
          'repair_orders',
          'repair_order_initial_problems.repair_order_id',
          'repair_orders.id',
        )
        .whereNull('repair_orders.id')
        .select('repair_order_initial_problems.*');

      expect(orphanedProblems.length).toBe(0);

      // Check for orphaned repair_order_comments
      const orphanedComments = await RepairOrderTestSetup.knex('repair_order_comments')
        .leftJoin('repair_orders', 'repair_order_comments.repair_order_id', 'repair_orders.id')
        .whereNull('repair_orders.id')
        .select('repair_order_comments.*');

      expect(orphanedComments.length).toBe(0);

      // Check for orphaned repair_order_history
      const orphanedHistory = await RepairOrderTestSetup.knex('repair_order_history')
        .leftJoin('repair_orders', 'repair_order_history.repair_order_id', 'repair_orders.id')
        .whereNull('repair_orders.id')
        .select('repair_order_history.*');

      expect(orphanedHistory.length).toBe(0);
    });
  });

  describe('Transaction Integrity', () => {
    it('should handle transaction rollbacks on errors', async () => {
      const initialCount = await RepairOrderTestSetup.knex('repair_orders')
        .count('* as count')
        .first();

      // Try to create repair order with invalid foreign key
      const invalidDto = await RepairOrderTestSetup.createValidRepairOrderDto({
        user_id: '12345678-1234-4000-8000-123456789012',
      });

      const response = await RepairOrderTestSetup.makeRequest()
        .post('/repair-orders')
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({
          branch_id: RepairOrderTestSetup.testData.branchData.id,
          status_id: RepairOrderTestSetup.testData.repairStatus.id,
        })
        .send(invalidDto);

      expect([400, 404]).toContain(response.status);

      // Verify no partial data was committed
      const finalCount = await RepairOrderTestSetup.knex('repair_orders')
        .count('* as count')
        .first();
      expect(finalCount.count).toBe(initialCount.count);

      // Verify no orphaned related records were created
      const orphanedProblems = await RepairOrderTestSetup.knex(
        'repair_order_initial_problems',
      ).where('repair_order_id', '12345678-1234-4000-8000-123456789012');
      expect(orphanedProblems.length).toBe(0);
    });

    it('should maintain data consistency during concurrent operations', async () => {
      const updatePromises = Array(10)
        .fill(null)
        .map((_, i) =>
          RepairOrderTestSetup.makeRequest()
            .patch(`/repair-orders/${repairOrderId}`)
            .set('Authorization', RepairOrderTestSetup.getAdminAuth())
            .send({ priority: i % 2 === 0 ? 'High' : 'Low' }),
        );

      const responses = await Promise.allSettled(updatePromises);

      // Verify final state is consistent
      const finalRecord = await RepairOrderTestSetup.knex('repair_orders')
        .where({ id: repairOrderId })
        .first();

      expect(finalRecord).toBeDefined();
      expect(['High', 'Low']).toContain(finalRecord.priority);

      // Verify all successful operations are tracked in history
      const successfulCount = responses.filter(
        (r) => r.status === 'fulfilled' && r.value.status === 200,
      ).length;

      const historyCount = await RepairOrderTestSetup.knex('repair_order_history')
        .where({ repair_order_id: repairOrderId, field_name: 'priority' })
        .count('* as count')
        .first();

      expect(parseInt(historyCount.count)).toBe(successfulCount);
    });

    it('should ensure atomic operations for complex updates', async () => {
      // Create a repair order with multiple related entities
      const complexDto = await RepairOrderTestSetup.createValidRepairOrderDto({
        initial_problems: [
          {
            problem_category_id: RepairOrderTestSetup.testData.problemCategory.id,
            price: 100000,
            estimated_minutes: 60,
            parts: [],
          },
          {
            problem_category_id: RepairOrderTestSetup.testData.problemCategory.id,
            price: 150000,
            estimated_minutes: 90,
            parts: [],
          },
        ],
        comments: [{ text: 'First comment' }, { text: 'Second comment' }],
      });

      const response = await RepairOrderTestSetup.makeRequest()
        .post('/repair-orders')
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({
          branch_id: RepairOrderTestSetup.testData.branchData.id,
          status_id: RepairOrderTestSetup.testData.repairStatus.id,
        })
        .send(complexDto);

      if (response.status === 201) {
        const newRepairOrderId = response.body.id;

        // Verify all related entities were created atomically
        const problems = await RepairOrderTestSetup.knex('repair_order_initial_problems').where({
          repair_order_id: newRepairOrderId,
        });
        const comments = await RepairOrderTestSetup.knex('repair_order_comments').where({
          repair_order_id: newRepairOrderId,
        });

        expect(problems.length).toBe(2);
        expect(comments.length).toBe(2);

        // Verify all have correct audit fields
        [...problems, ...comments].forEach((entity) => {
          expect(entity.created_by).toBe(RepairOrderTestSetup.testData.adminData.id);
          expect(entity.updated_by).toBe(RepairOrderTestSetup.testData.adminData.id);
          expect(entity.created_at).toBeTruthy();
          expect(entity.updated_at).toBeTruthy();
        });
      }
    });
  });

  describe('Data Consistency Validation', () => {
    it('should maintain calculated field consistency', async () => {
      // Update individual problem prices
      const problems = await RepairOrderTestSetup.knex('repair_order_initial_problems').where({
        repair_order_id: repairOrderId,
      });

      if (problems.length > 0) {
        const totalExpected = problems.reduce((sum, problem) => sum + parseFloat(problem.price), 0);

        // If the system auto-calculates totals, verify consistency
        const repairOrder = await RepairOrderTestSetup.knex('repair_orders')
          .where({ id: repairOrderId })
          .first();

        if (repairOrder.total !== null) {
          // This test assumes the system might auto-calculate totals
          // Adjust based on actual business logic
          expect(parseFloat(repairOrder.total)).toBeCloseTo(totalExpected, 2);
        }
      }
    });

    it('should validate business rule consistency', async () => {
      // Move to completed status
      await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${repairOrderId}/move`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({ status_id: RepairOrderTestSetup.testData.inProgressStatus.id })
        .send({ notes: 'Work started' });

      await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${repairOrderId}/move`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({ status_id: RepairOrderTestSetup.testData.completedStatus.id })
        .send({ notes: 'Work completed' });

      const completedRecord = await RepairOrderTestSetup.knex('repair_orders')
        .where({ id: repairOrderId })
        .first();

      expect(completedRecord.status_id).toBe(RepairOrderTestSetup.testData.completedStatus.id);

      // Business rule: completed orders should have final problems or at least initial problems
      const initialProblems = await RepairOrderTestSetup.knex(
        'repair_order_initial_problems',
      ).where({ repair_order_id: repairOrderId });
      const finalProblems = await RepairOrderTestSetup.knex('repair_order_final_problems').where({
        repair_order_id: repairOrderId,
      });

      expect(initialProblems.length + finalProblems.length).toBeGreaterThan(0);
    });

    it('should maintain timestamp consistency', async () => {
      // Perform several operations with known sequence
      const operations = [
        () =>
          RepairOrderTestSetup.makeRequest()
            .patch(`/repair-orders/${repairOrderId}`)
            .set('Authorization', RepairOrderTestSetup.getAdminAuth())
            .send({ priority: 'High' }),
        () =>
          RepairOrderTestSetup.makeRequest()
            .patch(`/repair-orders/${repairOrderId}/move`)
            .set('Authorization', RepairOrderTestSetup.getAdminAuth())
            .query({ status_id: RepairOrderTestSetup.testData.inProgressStatus.id })
            .send({ notes: 'Move to progress' }),
        () =>
          RepairOrderTestSetup.makeRequest()
            .patch(`/repair-orders/${repairOrderId}`)
            .set('Authorization', RepairOrderTestSetup.getAdminAuth())
            .send({ imei: '123456789012345' }),
      ];

      for (const operation of operations) {
        await operation();
        await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay
      }

      // Verify history timestamps are in correct order
      const historyRecords = await RepairOrderTestSetup.knex('repair_order_history')
        .where({ repair_order_id: repairOrderId })
        .orderBy('created_at', 'asc');

      for (let i = 1; i < historyRecords.length; i++) {
        const prevTime = new Date(historyRecords[i - 1].created_at);
        const currTime = new Date(historyRecords[i].created_at);
        expect(currTime.getTime()).toBeGreaterThanOrEqual(prevTime.getTime());
      }

      // Verify repair order updated_at reflects the latest change
      const finalRecord = await RepairOrderTestSetup.knex('repair_orders')
        .where({ id: repairOrderId })
        .first();
      const lastHistoryTime = new Date(historyRecords[historyRecords.length - 1].created_at);
      const recordUpdatedTime = new Date(finalRecord.updated_at);

      // Allow for small timing differences
      expect(Math.abs(recordUpdatedTime.getTime() - lastHistoryTime.getTime())).toBeLessThan(1000);
    });
  });
});
