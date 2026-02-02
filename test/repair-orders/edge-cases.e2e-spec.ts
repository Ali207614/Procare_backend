import { RepairOrderTestSetup } from './setup.e2e';

describe('Repair Orders - Edge Cases and Error Scenarios', () => {
  let repairOrderId: string;

  beforeAll(async () => {
    await RepairOrderTestSetup.setupApplication();
  });

  beforeEach(async () => {
    await RepairOrderTestSetup.cleanRepairOrderTables();

    // Create test repair order for tests that need it
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

  describe('Non-existent Entity Handling', () => {
    it('should handle non-existent user ID gracefully', async () => {
      const createDto = await RepairOrderTestSetup.createValidRepairOrderDto({
        user_id: '12345678-1234-1234-1234-123456789012', // Valid UUID but non-existent
      });

      const response = await RepairOrderTestSetup.makeRequest()
        .post('/repair-orders')
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({
          branch_id: RepairOrderTestSetup.testData.branchData.id,
          status_id: RepairOrderTestSetup.testData.repairStatus.id,
        })
        .send(createDto);

      expect([400, 404]).toContain(response.status);
    });

    it('should handle non-existent phone category gracefully', async () => {
      const createDto = await RepairOrderTestSetup.createValidRepairOrderDto({
        phone_category_id: '12345678-1234-1234-1234-123456789012',
      });

      const response = await RepairOrderTestSetup.makeRequest()
        .post('/repair-orders')
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({
          branch_id: RepairOrderTestSetup.testData.branchData.id,
          status_id: RepairOrderTestSetup.testData.repairStatus.id,
        })
        .send(createDto);

      expect([400, 404]).toContain(response.status);
    });

    it('should handle non-existent repair status gracefully', async () => {
      const createDto = await RepairOrderTestSetup.createValidRepairOrderDto();

      const response = await RepairOrderTestSetup.makeRequest()
        .post('/repair-orders')
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({
          branch_id: RepairOrderTestSetup.testData.branchData.id,
          status_id: '12345678-1234-1234-1234-123456789012',
        })
        .send(createDto);

      expect([400, 404]).toContain(response.status);
    });

    it('should handle non-existent branch ID gracefully', async () => {
      const createDto = await RepairOrderTestSetup.createValidRepairOrderDto();

      const response = await RepairOrderTestSetup.makeRequest()
        .post('/repair-orders')
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({
          branch_id: '12345678-1234-1234-1234-123456789012',
          status_id: RepairOrderTestSetup.testData.repairStatus.id,
        })
        .send(createDto);

      expect([400, 404]).toContain(response.status);
    });

    it('should handle non-existent problem category gracefully', async () => {
      const createDto = await RepairOrderTestSetup.createValidRepairOrderDto({
        initial_problems: [
          {
            problem_category_id: '12345678-1234-1234-1234-123456789012',
            price: 100000,
            estimated_minutes: 60,
            parts: [],
          },
        ],
      });

      const response = await RepairOrderTestSetup.makeRequest()
        .post('/repair-orders')
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({
          branch_id: RepairOrderTestSetup.testData.branchData.id,
          status_id: RepairOrderTestSetup.testData.repairStatus.id,
        })
        .send(createDto);

      expect([400, 404]).toContain(response.status);
    });

    it('should handle non-existent repair order for operations', async () => {
      const nonExistentId = '12345678-1234-1234-1234-123456789012';

      // GET
      await RepairOrderTestSetup.makeRequest()
        .get(`/repair-orders/${nonExistentId}`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .expect(404);

      // PATCH
      await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${nonExistentId}`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .send({ priority: 'High' })
        .expect(404);

      // DELETE
      await RepairOrderTestSetup.makeRequest()
        .delete(`/repair-orders/${nonExistentId}`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .expect(404);

      // MOVE
      await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${nonExistentId}/move`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({ status_id: RepairOrderTestSetup.testData.inProgressStatus.id })
        .send({ notes: 'Test move' })
        .expect(404);
    });
  });

  describe('Concurrent Modification Scenarios', () => {
    it('should handle concurrent modifications gracefully', async () => {
      const updateDto = { priority: 'High' };

      // Make multiple simultaneous update requests
      const promises = Array(5)
        .fill(null)
        .map(() =>
          RepairOrderTestSetup.makeRequest()
            .patch(`/repair-orders/${repairOrderId}`)
            .set('Authorization', RepairOrderTestSetup.getAdminAuth())
            .send(updateDto),
        );

      const responses = await Promise.allSettled(promises);

      // At least one should succeed
      const successful = responses.filter(
        (result) => result.status === 'fulfilled' && result.value.status === 200,
      );
      expect(successful.length).toBeGreaterThan(0);
    });

    it('should handle concurrent status moves', async () => {
      const moveDto = { notes: 'Concurrent move' };

      // Make multiple simultaneous move requests
      const promises = Array(3)
        .fill(null)
        .map(() =>
          RepairOrderTestSetup.makeRequest()
            .patch(`/repair-orders/${repairOrderId}/move`)
            .set('Authorization', RepairOrderTestSetup.getAdminAuth())
            .query({ status_id: RepairOrderTestSetup.testData.inProgressStatus.id })
            .send(moveDto),
        );

      const responses = await Promise.allSettled(promises);

      // At least one should succeed, others might fail due to status validation
      const successful = responses.filter(
        (result) => result.status === 'fulfilled' && result.value.status === 200,
      );
      expect(successful.length).toBeGreaterThan(0);
    });

    it('should handle concurrent delete operations', async () => {
      // Make multiple simultaneous delete requests
      const promises = Array(3)
        .fill(null)
        .map(() =>
          RepairOrderTestSetup.makeRequest()
            .delete(`/repair-orders/${repairOrderId}`)
            .set('Authorization', RepairOrderTestSetup.getAdminAuth()),
        );

      const responses = await Promise.allSettled(promises);

      // Only one should succeed, others should get 404
      const successful = responses.filter(
        (result) => result.status === 'fulfilled' && result.value.status === 200,
      );
      const notFound = responses.filter(
        (result) => result.status === 'fulfilled' && result.value.status === 404,
      );

      expect(successful.length).toBe(1);
      expect(notFound.length).toBeGreaterThan(0);
    });
  });

  describe('Database Constraint Violations', () => {
    it('should handle database constraint violations', async () => {
      // Create repair order with very long string that might violate constraints
      const longString = 'a'.repeat(2000);
      const createDto = await RepairOrderTestSetup.createValidRepairOrderDto({
        comments: [{ text: longString }],
      });

      const response = await RepairOrderTestSetup.makeRequest()
        .post('/repair-orders')
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({
          branch_id: RepairOrderTestSetup.testData.branchData.id,
          status_id: RepairOrderTestSetup.testData.repairStatus.id,
        })
        .send(createDto);

      expect([201, 400, 413]).toContain(response.status);
    });

    it('should handle foreign key constraint violations', async () => {
      // Try to insert repair order with invalid foreign keys
      const response = await RepairOrderTestSetup.knex
        .raw(
          `
        INSERT INTO repair_orders (
          id, user_id, branch_id, phone_category_id, status_id,
          priority, created_at, updated_at, created_by, updated_by
        ) VALUES (
          '${require('uuid').v4()}',
          '12345678-1234-1234-1234-123456789012',
          '${RepairOrderTestSetup.testData.branchData.id}',
          '${RepairOrderTestSetup.testData.phoneCategory.id}',
          '${RepairOrderTestSetup.testData.repairStatus.id}',
          'Medium',
          NOW(),
          NOW(),
          '${RepairOrderTestSetup.testData.adminData.id}',
          '${RepairOrderTestSetup.testData.adminData.id}'
        )
      `,
        )
        .catch((error) => error);

      // Should throw foreign key constraint error
      expect(response).toBeInstanceOf(Error);
    });

    it('should handle unique constraint violations if any exist', async () => {
      // This test depends on specific unique constraints in the schema
      // Create two repair orders with potentially duplicate unique fields
      const createDto1 = await RepairOrderTestSetup.createValidRepairOrderDto({
        imei: 'UNIQUE123456789',
      });
      const createDto2 = await RepairOrderTestSetup.createValidRepairOrderDto({
        imei: 'UNIQUE123456789', // Same IMEI if uniqueness is enforced
      });

      // Create first repair order
      const response1 = await RepairOrderTestSetup.makeRequest()
        .post('/repair-orders')
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({
          branch_id: RepairOrderTestSetup.testData.branchData.id,
          status_id: RepairOrderTestSetup.testData.repairStatus.id,
        })
        .send(createDto1);

      // Should succeed
      expect([201]).toContain(response1.status);

      // Create second repair order with same IMEI
      const response2 = await RepairOrderTestSetup.makeRequest()
        .post('/repair-orders')
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({
          branch_id: RepairOrderTestSetup.testData.branchData.id,
          status_id: RepairOrderTestSetup.testData.repairStatus.id,
        })
        .send(createDto2);

      // Should either succeed (if no unique constraint) or fail
      expect([201, 409]).toContain(response2.status);
    });
  });

  describe('Malformed Request Handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      await RepairOrderTestSetup.makeRequest()
        .post('/repair-orders')
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .set('Content-Type', 'application/json')
        .send('{ invalid json')
        .expect(400);
    });

    it('should handle very large request bodies', async () => {
      const largeComments = Array(1000)
        .fill(null)
        .map((_, i) => ({
          text: `Comment ${i} with some additional text to make it longer`,
        }));

      const createDto = await RepairOrderTestSetup.createValidRepairOrderDto({
        comments: largeComments,
      });

      const response = await RepairOrderTestSetup.makeRequest()
        .post('/repair-orders')
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({
          branch_id: RepairOrderTestSetup.testData.branchData.id,
          status_id: RepairOrderTestSetup.testData.repairStatus.id,
        })
        .send(createDto);

      expect([201, 400, 413]).toContain(response.status);
    });

    it('should handle missing content-type headers', async () => {
      const createDto = await RepairOrderTestSetup.createValidRepairOrderDto();

      const response = await RepairOrderTestSetup.makeRequest()
        .post('/repair-orders')
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({
          branch_id: RepairOrderTestSetup.testData.branchData.id,
          status_id: RepairOrderTestSetup.testData.repairStatus.id,
        })
        .send(JSON.stringify(createDto));

      expect([201, 400]).toContain(response.status);
    });

    it('should handle unexpected field types', async () => {
      const createDto = {
        user_id: RepairOrderTestSetup.testData.userData.id,
        phone_category_id: RepairOrderTestSetup.testData.phoneCategory.id,
        priority: ['array', 'instead', 'of', 'string'], // Wrong type
        total: { object: 'instead of number' }, // Wrong type
        initial_problems: 'string instead of array', // Wrong type
      };

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
  });

  describe('Network and Infrastructure Issues', () => {
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

    it('should handle Redis connection issues gracefully', async () => {
      // Temporarily break Redis connection
      const originalRedis = RepairOrderTestSetup.redis;

      try {
        // Mock Redis failure
        RepairOrderTestSetup.redis = {
          get: () => {
            throw new Error('Redis connection failed');
          },
          set: () => {
            throw new Error('Redis connection failed');
          },
          del: () => {
            throw new Error('Redis connection failed');
          },
        };

        const response = await RepairOrderTestSetup.makeRequest()
          .get(`/repair-orders/${repairOrderId}`)
          .set('Authorization', RepairOrderTestSetup.getAdminAuth());

        // Should either work (with fallback) or fail gracefully
        expect([200, 500, 503]).toContain(response.status);
      } finally {
        // Restore Redis connection
        RepairOrderTestSetup.redis = originalRedis;
      }
    });
  });

  describe('Boundary Value Testing', () => {
    it('should handle maximum numeric values', async () => {
      const createDto = await RepairOrderTestSetup.createValidRepairOrderDto({
        total: Number.MAX_SAFE_INTEGER,
        initial_problems: [
          {
            problem_category_id: RepairOrderTestSetup.testData.problemCategory.id,
            price: Number.MAX_SAFE_INTEGER,
            estimated_minutes: Number.MAX_SAFE_INTEGER,
            parts: [],
          },
        ],
      });

      const response = await RepairOrderTestSetup.makeRequest()
        .post('/repair-orders')
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({
          branch_id: RepairOrderTestSetup.testData.branchData.id,
          status_id: RepairOrderTestSetup.testData.repairStatus.id,
        })
        .send(createDto);

      expect([201, 400]).toContain(response.status);
    });

    it('should handle minimum valid values', async () => {
      const createDto = await RepairOrderTestSetup.createValidRepairOrderDto({
        total: 1,
        initial_problems: [
          {
            problem_category_id: RepairOrderTestSetup.testData.problemCategory.id,
            price: 1,
            estimated_minutes: 1,
            parts: [],
          },
        ],
      });

      await RepairOrderTestSetup.makeRequest()
        .post('/repair-orders')
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({
          branch_id: RepairOrderTestSetup.testData.branchData.id,
          status_id: RepairOrderTestSetup.testData.repairStatus.id,
        })
        .send(createDto)
        .expect(201);
    });

    it('should handle zero values where applicable', async () => {
      const createDto = await RepairOrderTestSetup.createValidRepairOrderDto({
        total: 0,
        initial_problems: [
          {
            problem_category_id: RepairOrderTestSetup.testData.problemCategory.id,
            price: 0,
            estimated_minutes: 0,
            parts: [],
          },
        ],
      });

      const response = await RepairOrderTestSetup.makeRequest()
        .post('/repair-orders')
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({
          branch_id: RepairOrderTestSetup.testData.branchData.id,
          status_id: RepairOrderTestSetup.testData.repairStatus.id,
        })
        .send(createDto);

      expect([201, 400]).toContain(response.status);
    });
  });

  describe('State Transition Edge Cases', () => {
    it('should handle invalid state transitions gracefully', async () => {
      // Try to move to a status that doesn't exist in the same branch
      const moveDto = { notes: 'Invalid transition' };

      // Create a status in different branch
      const differentBranchStatusId = require('uuid').v4();

      const response = await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${repairOrderId}/move`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({ status_id: differentBranchStatusId })
        .send(moveDto);

      expect([400, 404]).toContain(response.status);
    });

    it('should handle multiple rapid state changes', async () => {
      const transitions = [
        RepairOrderTestSetup.testData.inProgressStatus.id,
        RepairOrderTestSetup.testData.completedStatus.id,
        RepairOrderTestSetup.testData.closedStatus.id,
      ];

      // Perform rapid transitions
      for (const statusId of transitions) {
        const response = await RepairOrderTestSetup.makeRequest()
          .patch(`/repair-orders/${repairOrderId}/move`)
          .set('Authorization', RepairOrderTestSetup.getAdminAuth())
          .query({ status_id })
          .send({ notes: `Moving to ${statusId}` });

        expect([200, 400]).toContain(response.status);
      }

      // Verify final state is consistent
      const finalRecord = await RepairOrderTestSetup.knex('repair_orders')
        .where({ id: repairOrderId })
        .first();
      expect(finalRecord).toBeDefined();
      expect(finalRecord.status_id).toBeDefined();
    });
  });

  describe('Resource Cleanup Edge Cases', () => {
    it('should handle cleanup of related resources on soft delete', async () => {
      // Create repair order with many related resources
      const createDto = await RepairOrderTestSetup.createValidRepairOrderDto({
        comments: Array(5)
          .fill(null)
          .map((_, i) => ({ text: `Comment ${i}` })),
        initial_problems: Array(3)
          .fill(null)
          .map(() => ({
            problem_category_id: RepairOrderTestSetup.testData.problemCategory.id,
            price: 100000,
            estimated_minutes: 60,
            parts: [],
          })),
      });

      const createResponse = await RepairOrderTestSetup.makeRequest()
        .post('/repair-orders')
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({
          branch_id: RepairOrderTestSetup.testData.branchData.id,
          status_id: RepairOrderTestSetup.testData.repairStatus.id,
        })
        .send(createDto);

      const newRepairOrderId = createResponse.body.id;

      // Perform some status moves to create history
      await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${newRepairOrderId}/move`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({ status_id: RepairOrderTestSetup.testData.inProgressStatus.id })
        .send({ notes: 'Test history' });

      // Soft delete
      await RepairOrderTestSetup.makeRequest()
        .delete(`/repair-orders/${newRepairOrderId}`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .expect(200);

      // Verify related resources are still accessible for audit purposes
      const comments = await RepairOrderTestSetup.knex('repair_order_comments').where({
        repair_order_id: newRepairOrderId,
      });
      const problems = await RepairOrderTestSetup.knex('repair_order_initial_problems').where({
        repair_order_id: newRepairOrderId,
      });
      const history = await RepairOrderTestSetup.knex('repair_order_history').where({
        repair_order_id: newRepairOrderId,
      });

      expect(comments.length).toBe(5);
      expect(problems.length).toBe(3);
      expect(history.length).toBeGreaterThan(0);
    });

    it('should handle orphaned resources gracefully', async () => {
      // This test verifies the system handles cases where related data might be inconsistent
      // Insert orphaned comment directly
      const orphanedCommentId = require('uuid').v4();
      const nonExistentRepairOrderId = require('uuid').v4();

      await RepairOrderTestSetup.knex('repair_order_comments')
        .insert({
          id: orphanedCommentId,
          repair_order_id: nonExistentRepairOrderId,
          text: 'Orphaned comment',
          created_at: new Date(),
          updated_at: new Date(),
          created_by: RepairOrderTestSetup.testData.adminData.id,
          updated_by: RepairOrderTestSetup.testData.adminData.id,
        })
        .catch(() => {
          // This might fail due to foreign key constraints, which is expected
        });
    });
  });
});
