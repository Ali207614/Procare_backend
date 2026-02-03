import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { RepairOrdersService } from '../../src/repair-orders/repair-orders.service';
import { NotificationService } from '../../src/notification/notification.service';
import { CampaignsService } from '../../src/campaigns/campaigns.service';
import { AdminFactory } from '../factories/admin.factory';
import { UserFactory } from '../factories/user.factory';
import { BranchFactory } from '../factories/branch.factory';
import { RepairOrderFactory } from '../factories/repair-order.factory';
import { TestHelpers } from '../utils/test-helpers';
import { MockFactory } from '../utils/mock-factory';
import { TestModuleBuilder } from '../utils/test-module-builder';

describe('Repair Order Workflow (Integration)', () => {
  let app: INestApplication;
  let repairOrdersService: RepairOrdersService;
  let notificationService: NotificationService;
  let campaignsService: CampaignsService;
  let knex: any;
  let redis: any;

  let adminData: any;
  let userData: any;
  let branchData: any;
  let repairOrderData: any;

  beforeAll(async () => {
    const module = await TestModuleBuilder.forIntegrationTest().build();

    app = module.createNestApplication();
    TestHelpers.configureTestApp(app);
    await app.init();

    repairOrdersService = module.get<RepairOrdersService>(RepairOrdersService);
    notificationService = module.get<NotificationService>(NotificationService);
    campaignsService = module.get<CampaignsService>(CampaignsService);
    knex = module.get('KnexConnection');
    redis = module.get('RedisClient');

    // Setup test data
    branchData = await BranchFactory.create(knex);
    adminData = await AdminFactory.create(knex, { branch_id: branchData.id });
    userData = await UserFactory.create(knex);
  });

  beforeEach(async () => {
    await TestHelpers.cleanRepairOrdersTable(knex);
    await TestHelpers.cleanNotificationsTable(knex);
    await redis.flushall();
  });

  afterAll(async () => {
    await TestHelpers.cleanDatabase(knex);
    await app.close();
  });

  describe('Complete Repair Order Lifecycle', () => {
    it('should handle complete repair order lifecycle from creation to completion', async () => {
      // Phase 1: Create Repair Order
      const createDto = RepairOrderFactory.createDto({
        customer_phone: userData.phone_number,
        device_type: 'iPhone 14 Pro',
        initial_problem: 'Cracked screen and battery drain',
        branch_id: branchData.id,
      });

      const createResult = await repairOrdersService.create(createDto, adminData.id);
      expect(createResult.message).toBe('Repair order created successfully');

      const repairOrderId = createResult.repair_order_id;

      // Verify initial state
      const initialOrder = await repairOrdersService.findOne(repairOrderId);
      expect(initialOrder.data.status).toBe('Open');
      expect(initialOrder.data.created_by).toBe(adminData.id);

      // Phase 2: Assign Admin and Start Diagnosis
      await repairOrdersService.assignAdmin(repairOrderId, adminData.id, adminData.id);

      const assignedOrder = await repairOrdersService.findOne(repairOrderId);
      expect(assignedOrder.data.assigned_admin_id).toBe(adminData.id);

      // Change status to In Progress
      await repairOrdersService.changeStatus(repairOrderId, 'In Progress', adminData.id, {
        diagnosis_notes: 'Screen replacement needed, battery test pending',
      });

      const inProgressOrder = await repairOrdersService.findOne(repairOrderId);
      expect(inProgressOrder.data.status).toBe('In Progress');

      // Phase 3: Add Comments and Updates
      await repairOrdersService.addComment(
        repairOrderId,
        {
          comment: 'Ordered replacement screen, ETA 2 days',
          is_internal: true,
        },
        adminData.id,
      );

      await repairOrdersService.addComment(
        repairOrderId,
        {
          comment: 'Customer notified about delay',
          is_internal: false,
        },
        adminData.id,
      );

      // Phase 4: Upload Attachments
      const mockFile = MockFactory.createMockFile({
        originalname: 'device-damage-photo.jpg',
        mimetype: 'image/jpeg',
      });

      await repairOrdersService.uploadAttachment(
        repairOrderId,
        mockFile,
        { description: 'Photo of screen damage', attachment_type: 'image' },
        adminData.id,
      );

      // Phase 5: Customer Communication
      const notificationResult = await notificationService.create(
        {
          type: 'SMS',
          recipient_id: userData.id,
          message: 'Your repair is in progress. Parts ordered, estimated completion: 3 days.',
          phone_number: userData.phone_number,
          related_repair_order_id: repairOrderId,
        },
        adminData.id,
      );

      expect(notificationResult.message).toBe('Notification created successfully');

      // Phase 6: Complete Repair
      await repairOrdersService.changeStatus(repairOrderId, 'Completed', adminData.id, {
        completion_notes: 'Screen replaced, battery tested - all working properly',
        final_cost: 299.99,
        warranty_period_days: 90,
      });

      const completedOrder = await repairOrdersService.findOne(repairOrderId);
      expect(completedOrder.data.status).toBe('Completed');
      expect(completedOrder.data.final_cost).toBe(299.99);
      expect(completedOrder.data.completion_date).toBeDefined();

      // Phase 7: Completion Notification
      await notificationService.create(
        {
          type: 'SMS',
          recipient_id: userData.id,
          message: 'Your device repair is complete! Please visit us to collect your device.',
          phone_number: userData.phone_number,
          related_repair_order_id: repairOrderId,
        },
        adminData.id,
      );

      // Phase 8: Customer Pickup
      await repairOrdersService.changeStatus(repairOrderId, 'Collected', adminData.id, {
        pickup_notes: 'Device collected by customer',
        picked_up_at: new Date(),
      });

      // Verify final state
      const finalOrder = await repairOrdersService.findOne(repairOrderId);
      expect(finalOrder.data.status).toBe('Collected');
      expect(finalOrder.data.picked_up_at).toBeDefined();

      // Verify audit trail
      const orderHistory = await knex('repair_order_history')
        .where({ repair_order_id: repairOrderId })
        .orderBy('created_at', 'asc');

      expect(orderHistory.length).toBeGreaterThan(3);
      expect(orderHistory[0].change_type).toBe('status_change');
      expect(orderHistory[0].old_value).toBe('Open');
      expect(orderHistory[0].new_value).toBe('In Progress');
    });

    it('should handle repair order cancellation workflow', async () => {
      // Create repair order
      const createDto = RepairOrderFactory.createDto({
        customer_phone: userData.phone_number,
        branch_id: branchData.id,
      });

      const createResult = await repairOrdersService.create(createDto, adminData.id);
      const repairOrderId = createResult.repair_order_id;

      // Customer decides to cancel
      await repairOrdersService.addComment(
        repairOrderId,
        {
          comment: 'Customer called to cancel repair - found cheaper alternative',
          is_internal: true,
        },
        adminData.id,
      );

      // Cancel the repair order
      await repairOrdersService.changeStatus(repairOrderId, 'Cancelled', adminData.id, {
        cancellation_reason: 'Customer request',
        cancelled_by: 'customer',
      });

      // Send cancellation notification
      await notificationService.create(
        {
          type: 'SMS',
          recipient_id: userData.id,
          message: 'Your repair order has been cancelled as requested.',
          phone_number: userData.phone_number,
          related_repair_order_id: repairOrderId,
        },
        adminData.id,
      );

      // Verify cancellation
      const cancelledOrder = await repairOrdersService.findOne(repairOrderId);
      expect(cancelledOrder.data.status).toBe('Cancelled');
      expect(cancelledOrder.data.cancellation_reason).toBe('Customer request');
    });
  });

  describe('Bulk Operations and Batch Processing', () => {
    it('should handle bulk repair order updates', async () => {
      // Create multiple repair orders
      const repairOrders = [];
      for (let i = 0; i < 5; i++) {
        const createDto = RepairOrderFactory.createDto({
          customer_phone: `+123456789${i}`,
          device_type: `Device ${i}`,
          branch_id: branchData.id,
        });
        const result = await repairOrdersService.create(createDto, adminData.id);
        repairOrders.push(result.repair_order_id);
      }

      // Bulk assign admin
      const bulkAssignPromises = repairOrders.map((id) =>
        repairOrdersService.assignAdmin(id, adminData.id, adminData.id),
      );

      const assignResults = await Promise.all(bulkAssignPromises);
      expect(assignResults).toHaveLength(5);
      assignResults.forEach((result) => {
        expect(result.message).toBe('Admin assigned successfully');
      });

      // Bulk status change
      const bulkStatusPromises = repairOrders.map((id) =>
        repairOrdersService.changeStatus(id, 'In Progress', adminData.id),
      );

      const statusResults = await Promise.all(bulkStatusPromises);
      expect(statusResults).toHaveLength(5);

      // Verify all orders are in progress
      const orders = await Promise.all(repairOrders.map((id) => repairOrdersService.findOne(id)));

      orders.forEach((order) => {
        expect(order.data.status).toBe('In Progress');
        expect(order.data.assigned_admin_id).toBe(adminData.id);
      });
    });

    it('should handle batch notifications for repair order updates', async () => {
      // Create repair orders
      const repairOrders = [];
      for (let i = 0; i < 3; i++) {
        const createDto = RepairOrderFactory.createDto({
          customer_phone: `+123456789${i}`,
          branch_id: branchData.id,
        });
        const result = await repairOrdersService.create(createDto, adminData.id);
        repairOrders.push({
          id: result.repair_order_id,
          customer_phone: `+123456789${i}`,
        });
      }

      // Complete all repairs
      for (const order of repairOrders) {
        await repairOrdersService.changeStatus(order.id, 'Completed', adminData.id, {
          completion_notes: 'Repair completed successfully',
        });
      }

      // Send batch completion notifications
      const batchNotificationPromises = repairOrders.map((order) =>
        notificationService.create(
          {
            type: 'SMS',
            recipient_id: userData.id, // In real scenario, this would be different for each
            message: 'Your device repair is complete!',
            phone_number: order.customer_phone,
            related_repair_order_id: order.id,
          },
          adminData.id,
        ),
      );

      const notificationResults = await Promise.all(batchNotificationPromises);
      expect(notificationResults).toHaveLength(3);

      notificationResults.forEach((result) => {
        expect(result.message).toBe('Notification created successfully');
      });
    });
  });

  describe('Campaign Integration Workflow', () => {
    it('should create and send campaign for repair order follow-ups', async () => {
      // Create completed repair orders
      const completedOrders = [];
      for (let i = 0; i < 3; i++) {
        const createDto = RepairOrderFactory.createDto({
          customer_phone: `+123456789${i}`,
          branch_id: branchData.id,
        });
        const result = await repairOrdersService.create(createDto, adminData.id);

        // Complete the order
        await repairOrdersService.changeStatus(result.repair_order_id, 'Completed', adminData.id);

        completedOrders.push(result.repair_order_id);
      }

      // Create follow-up campaign
      const campaignDto = {
        type: 'SMS',
        message: 'How was your repair experience? We value your feedback!',
        target_audience: 'completed_repairs_last_week',
        scheduled_at: new Date(Date.now() + 3600000), // 1 hour from now
      };

      const campaignResult = await campaignsService.create(campaignDto, adminData.id);
      expect(campaignResult.message).toBe('Campaign created successfully');

      // Send campaign
      const sendResult = await campaignsService.sendCampaign(
        campaignResult.campaign_id,
        adminData.id,
      );
      expect(sendResult.message).toBe('Campaign queued for sending');

      // Verify campaign status
      const campaign = await campaignsService.findOne(campaignResult.campaign_id);
      expect(campaign.data.status).toBe('Processing');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle concurrent modifications gracefully', async () => {
      // Create repair order
      const createDto = RepairOrderFactory.createDto({
        customer_phone: userData.phone_number,
        branch_id: branchData.id,
      });

      const createResult = await repairOrdersService.create(createDto, adminData.id);
      const repairOrderId = createResult.repair_order_id;

      // Simulate concurrent updates
      const updatePromises = [
        repairOrdersService.update(repairOrderId, { notes: 'Update 1' }, adminData.id),
        repairOrdersService.update(repairOrderId, { notes: 'Update 2' }, adminData.id),
        repairOrdersService.update(repairOrderId, { notes: 'Update 3' }, adminData.id),
      ];

      // All updates should succeed (last one wins)
      const results = await Promise.all(updatePromises);
      results.forEach((result) => {
        expect(result.message).toBe('Repair order updated successfully');
      });

      // Verify final state
      const finalOrder = await repairOrdersService.findOne(repairOrderId);
      expect(finalOrder.data.notes).toBeDefined();
    });

    it('should handle rollback on transaction failure', async () => {
      // Mock a transaction failure scenario
      const originalTransaction = knex.transaction;
      knex.transaction = jest.fn().mockRejectedValue(new Error('Database error'));

      const createDto = RepairOrderFactory.createDto({
        customer_phone: userData.phone_number,
        branch_id: branchData.id,
      });

      // Should handle the error gracefully
      await expect(repairOrdersService.create(createDto, adminData.id)).rejects.toThrow(
        'Database error',
      );

      // Restore original function
      knex.transaction = originalTransaction;
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large volume operations efficiently', async () => {
      const startTime = Date.now();

      // Create many repair orders
      const createPromises = Array.from({ length: 50 }, (_, i) =>
        repairOrdersService.create(
          RepairOrderFactory.createDto({
            customer_phone: `+1234567${i.toString().padStart(3, '0')}`,
            device_type: `Device ${i}`,
            branch_id: branchData.id,
          }),
          adminData.id,
        ),
      );

      const createResults = await Promise.all(createPromises);
      expect(createResults).toHaveLength(50);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds for 50 operations
    });

    it('should maintain cache consistency during bulk operations', async () => {
      // Create repair order
      const createDto = RepairOrderFactory.createDto({
        customer_phone: userData.phone_number,
        branch_id: branchData.id,
      });

      const createResult = await repairOrdersService.create(createDto, adminData.id);
      const repairOrderId = createResult.repair_order_id;

      // Cache the repair order
      await repairOrdersService.findOne(repairOrderId);

      // Update the order (should invalidate cache)
      await repairOrdersService.update(repairOrderId, { notes: 'Updated notes' }, adminData.id);

      // Fetch again (should return updated data, not cached)
      const updatedOrder = await repairOrdersService.findOne(repairOrderId);
      expect(updatedOrder.data.notes).toBe('Updated notes');

      // Verify cache was properly invalidated
      const cacheKey = `repair_order:${repairOrderId}`;
      const cachedData = await redis.get(cacheKey);
      expect(cachedData).toBeNull();
    });
  });

  describe('Integration with External Services', () => {
    it('should handle external service failures gracefully', async () => {
      // Create repair order
      const createDto = RepairOrderFactory.createDto({
        customer_phone: userData.phone_number,
        branch_id: branchData.id,
      });

      const createResult = await repairOrdersService.create(createDto, adminData.id);
      const repairOrderId = createResult.repair_order_id;

      // Mock external service failure
      const mockSmsService = app.get('SmsService');
      mockSmsService.sendSms.mockRejectedValue(new Error('SMS service unavailable'));

      // Should still complete the repair order update
      await repairOrdersService.changeStatus(repairOrderId, 'Completed', adminData.id);

      // Verify order was updated despite notification failure
      const completedOrder = await repairOrdersService.findOne(repairOrderId);
      expect(completedOrder.data.status).toBe('Completed');

      // Should have logged the error and possibly queued for retry
      // (Implementation dependent on your error handling strategy)
    });
  });

  describe('Data Integrity and Validation', () => {
    it('should maintain referential integrity across related entities', async () => {
      // Create repair order with all related entities
      const createDto = RepairOrderFactory.createDto({
        customer_phone: userData.phone_number,
        branch_id: branchData.id,
      });

      const createResult = await repairOrdersService.create(createDto, adminData.id);
      const repairOrderId = createResult.repair_order_id;

      // Add related data
      await repairOrdersService.addComment(
        repairOrderId,
        {
          comment: 'Test comment',
          is_internal: false,
        },
        adminData.id,
      );

      await repairOrdersService.uploadAttachment(
        repairOrderId,
        MockFactory.createMockFile(),
        { description: 'Test attachment' },
        adminData.id,
      );

      // Verify all related data exists
      const comments = await knex('repair_order_comments').where({
        repair_order_id: repairOrderId,
      });
      expect(comments).toHaveLength(1);

      const attachments = await knex('repair_order_attachments').where({
        repair_order_id: repairOrderId,
      });
      expect(attachments).toHaveLength(1);

      // Delete repair order (should handle related data appropriately)
      await repairOrdersService.remove(repairOrderId, adminData.id);

      // Verify soft delete
      const deletedOrder = await knex('repair_orders').where({ id: repairOrderId }).first();
      expect(deletedOrder.deleted_at).toBeDefined();

      // Related data should still exist (depending on your business rules)
      const commentsAfterDelete = await knex('repair_order_comments').where({
        repair_order_id: repairOrderId,
      });
      expect(commentsAfterDelete).toHaveLength(1);
    });
  });
});
