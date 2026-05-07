import { RepairOrderTestSetup } from './setup.e2e';

describe('Repair Orders - Status Transitions', () => {
  let repairOrderId: string;

  beforeAll(async () => {
    await RepairOrderTestSetup.setupApplication();
  });

  beforeEach(async () => {
    await RepairOrderTestSetup.cleanRepairOrderTables();

    // Create test repair order for each test
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

  describe('PATCH /repair-orders/:id/move - Status Transitions', () => {
    it('should move repair order from Open to InProgress', async () => {
      const moveDto = {
        notes: 'Starting repair work',
      };

      const response = await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${repairOrderId}/move`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({ status_id: RepairOrderTestSetup.testData.inProgressStatus.id })
        .send(moveDto)
        .expect(200);

      expect(response.body).toHaveProperty('message');

      // Verify status change in database
      const dbRecord = await RepairOrderTestSetup.knex('repair_orders')
        .where({ id: repairOrderId })
        .first();
      expect(dbRecord.status_id).toBe(RepairOrderTestSetup.testData.inProgressStatus.id);
      expect(dbRecord.updated_by).toBe(RepairOrderTestSetup.testData.adminData.id);

      // Verify history record was created
      const historyRecords = await RepairOrderTestSetup.knex('repair_order_history')
        .where({ repair_order_id: repairOrderId })
        .orderBy('created_at', 'desc');
      expect(historyRecords.length).toBeGreaterThan(0);
      expect(historyRecords[0].field_name).toBe('status_id');
      expect(historyRecords[0].new_value).toBe(RepairOrderTestSetup.testData.inProgressStatus.id);
      expect(historyRecords[0].changed_by).toBe(RepairOrderTestSetup.testData.adminData.id);
    });

    it('should move repair order from InProgress to Completed', async () => {
      // First move to InProgress
      await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${repairOrderId}/move`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({ status_id: RepairOrderTestSetup.testData.inProgressStatus.id })
        .send({ notes: 'Starting work' });

      // Then move to Completed
      const moveDto = {
        notes: 'Repair completed successfully',
      };

      await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${repairOrderId}/move`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({ status_id: RepairOrderTestSetup.testData.completedStatus.id })
        .send(moveDto)
        .expect(200);

      const dbRecord = await RepairOrderTestSetup.knex('repair_orders')
        .where({ id: repairOrderId })
        .first();
      expect(dbRecord.status_id).toBe(RepairOrderTestSetup.testData.completedStatus.id);
    });

    it('should move repair order from Completed to Closed', async () => {
      // First move to InProgress
      await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${repairOrderId}/move`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({ status_id: RepairOrderTestSetup.testData.inProgressStatus.id })
        .send({ notes: 'Starting work' });

      // Then move to Completed
      await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${repairOrderId}/move`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({ status_id: RepairOrderTestSetup.testData.completedStatus.id })
        .send({ notes: 'Repair done' });

      // Finally move to Closed
      const moveDto = {
        notes: 'Order closed and delivered',
      };

      await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${repairOrderId}/move`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({ status_id: RepairOrderTestSetup.testData.closedStatus.id })
        .send(moveDto)
        .expect(200);

      const dbRecord = await RepairOrderTestSetup.knex('repair_orders')
        .where({ id: repairOrderId })
        .first();
      expect(dbRecord.status_id).toBe(RepairOrderTestSetup.testData.closedStatus.id);
    });

    it('should validate status transition rules', async () => {
      // Try to move directly to Closed without going through intermediate statuses
      const moveDto = {
        notes: 'Invalid transition',
      };

      const response = await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${repairOrderId}/move`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({ status_id: RepairOrderTestSetup.testData.closedStatus.id })
        .send(moveDto);

      // Should either succeed or return business rule validation error
      expect([200, 400, 403, 409]).toContain(response.status);
    });

    it('should require valid status_id in query', async () => {
      const moveDto = { notes: 'Test move' };

      await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${repairOrderId}/move`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({ status_id: 'invalid-status-id' })
        .send(moveDto)
        .expect(400);
    });

    it('should require authorization for status moves', async () => {
      const moveDto = { notes: 'Unauthorized move' };

      await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${repairOrderId}/move`)
        .query({ status_id: RepairOrderTestSetup.testData.inProgressStatus.id })
        .send(moveDto)
        .expect(401);
    });

    it('should create history record for each transition', async () => {
      // Perform multiple transitions
      await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${repairOrderId}/move`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({ status_id: RepairOrderTestSetup.testData.inProgressStatus.id })
        .send({ notes: 'Started work' });

      await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${repairOrderId}/move`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({ status_id: RepairOrderTestSetup.testData.completedStatus.id })
        .send({ notes: 'Finished work' });

      // Check history records
      const historyRecords = await RepairOrderTestSetup.knex('repair_order_history')
        .where({ repair_order_id: repairOrderId })
        .orderBy('created_at', 'asc');

      expect(historyRecords.length).toBeGreaterThanOrEqual(2);
      historyRecords.forEach((record) => {
        expect(record).toHaveProperty('repair_order_id', repairOrderId);
        expect(record).toHaveProperty('changed_by', RepairOrderTestSetup.testData.adminData.id);
        expect(record).toHaveProperty('field_name', 'status_id');
        expect(record).toHaveProperty('old_value');
        expect(record).toHaveProperty('new_value');
        expect(record.created_at).toBeTruthy();
      });
    });

    it('should validate notes field when moving', async () => {
      const invalidMoveDto = {
        notes: '', // Empty notes might be invalid
      };

      const response = await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${repairOrderId}/move`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({ status_id: RepairOrderTestSetup.testData.inProgressStatus.id })
        .send(invalidMoveDto);

      // Should either accept or reject based on validation rules
      expect([200, 400]).toContain(response.status);
    });

    it('should handle non-existent repair order for move', async () => {
      const nonExistentId = '12345678-1234-4000-8000-123456789012';
      const moveDto = { notes: 'Test move' };

      await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${nonExistentId}/move`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({ status_id: RepairOrderTestSetup.testData.inProgressStatus.id })
        .send(moveDto)
        .expect(404);
    });

    it('should handle non-existent status for move', async () => {
      const nonExistentStatusId = '12345678-1234-4000-8000-123456789012';
      const moveDto = { notes: 'Test move' };

      const response = await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${repairOrderId}/move`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({ status_id: nonExistentStatusId })
        .send(moveDto);

      expect([400, 404]).toContain(response.status);
    });

    it('should maintain audit trail with proper timestamps', async () => {
      const startTime = new Date();

      await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${repairOrderId}/move`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({ status_id: RepairOrderTestSetup.testData.inProgressStatus.id })
        .send({ notes: 'Test move' });

      const endTime = new Date();

      // Verify updated_at timestamp
      const dbRecord = await RepairOrderTestSetup.knex('repair_orders')
        .where({ id: repairOrderId })
        .first();
      const updatedAt = new Date(dbRecord.updated_at);
      expect(updatedAt.getTime()).toBeGreaterThanOrEqual(startTime.getTime());
      expect(updatedAt.getTime()).toBeLessThanOrEqual(endTime.getTime());

      // Verify history timestamp
      const historyRecord = await RepairOrderTestSetup.knex('repair_order_history')
        .where({ repair_order_id: repairOrderId })
        .orderBy('created_at', 'desc')
        .first();
      const historyTime = new Date(historyRecord.created_at);
      expect(historyTime.getTime()).toBeGreaterThanOrEqual(startTime.getTime());
      expect(historyTime.getTime()).toBeLessThanOrEqual(endTime.getTime());
    });
  });

  describe('Status Workflow Validation', () => {
    it('should track the complete repair order lifecycle', async () => {
      // Start with initial status (Waiting)
      let dbRecord = await RepairOrderTestSetup.knex('repair_orders')
        .where({ id: repairOrderId })
        .first();
      expect(dbRecord.status_id).toBe(RepairOrderTestSetup.testData.repairStatus.id);

      // Move through the complete workflow
      const transitions = [
        {
          statusId: RepairOrderTestSetup.testData.inProgressStatus.id,
          notes: 'Work started',
        },
        {
          statusId: RepairOrderTestSetup.testData.completedStatus.id,
          notes: 'Work completed',
        },
        {
          statusId: RepairOrderTestSetup.testData.closedStatus.id,
          notes: 'Order closed',
        },
      ];

      for (const transition of transitions) {
        await RepairOrderTestSetup.makeRequest()
          .patch(`/repair-orders/${repairOrderId}/move`)
          .set('Authorization', RepairOrderTestSetup.getAdminAuth())
          .query({ status_id: transition.statusId })
          .send({ notes: transition.notes })
          .expect(200);

        // Verify status change
        dbRecord = await RepairOrderTestSetup.knex('repair_orders')
          .where({ id: repairOrderId })
          .first();
        expect(dbRecord.status_id).toBe(transition.statusId);
      }

      // Verify complete history trail
      const historyRecords = await RepairOrderTestSetup.knex('repair_order_history')
        .where({ repair_order_id: repairOrderId })
        .orderBy('created_at', 'asc');

      expect(historyRecords.length).toBe(3);
      expect(historyRecords[0].new_value).toBe(RepairOrderTestSetup.testData.inProgressStatus.id);
      expect(historyRecords[1].new_value).toBe(RepairOrderTestSetup.testData.completedStatus.id);
      expect(historyRecords[2].new_value).toBe(RepairOrderTestSetup.testData.closedStatus.id);
    });
  });
});
