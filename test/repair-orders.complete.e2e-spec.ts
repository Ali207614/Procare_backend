import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AdminFactory } from './factories/admin.factory';
import { UserFactory } from './factories/user.factory';
import { BranchFactory } from './factories/branch.factory';
import { RepairOrderFactory } from './factories/repair-order.factory';
import { TestHelpers } from './utils/test-helpers';

describe('Repair Orders - Complete E2E', () => {
  let app: INestApplication;
  let knex: any;
  let authToken: string;
  let adminData: any;
  let userData: any;
  let branchData: any;
  let repairOrderId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    knex = moduleFixture.get('KnexConnection');

    // Setup test data
    branchData = await BranchFactory.create(knex);
    adminData = await AdminFactory.create(knex, { branch_id: branchData.id });
    userData = await UserFactory.create(knex);
    authToken = await TestHelpers.authenticateAdmin(app, adminData);
  });

  beforeEach(async () => {
    await TestHelpers.cleanRepairOrdersTable(knex);
  });

  afterAll(async () => {
    await TestHelpers.cleanDatabase(knex);
    await app.close();
  });

  describe('POST /repair-orders - Create Repair Order', () => {
    it('should create a new repair order successfully', async () => {
      const createDto = {
        user_id: userData.id,
        phone_category_id: 'phone-category-id',
        status_id: 'status-id',
        device_info: 'iPhone 14 Pro',
        problem_description: 'Screen cracked',
        estimated_cost: 299.99,
      };

      const response = await request(app.getHttpServer())
        .post('/repair-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.device_info).toBe(createDto.device_info);
      expect(response.body.problem_description).toBe(createDto.problem_description);

      // Verify database record
      const dbRecord = await knex('repair_orders').where({ id: response.body.id }).first();
      expect(dbRecord).toBeDefined();
      expect(dbRecord.user_id).toBe(createDto.user_id);
      expect(dbRecord.created_by).toBe(adminData.id);

      repairOrderId = response.body.id;
    });

    it('should validate required fields', async () => {
      const invalidDto = {
        device_info: 'iPhone 14',
        // Missing required fields
      };

      await request(app.getHttpServer())
        .post('/repair-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidDto)
        .expect(400);
    });

    it('should reject unauthorized requests', async () => {
      const createDto = {
        user_id: userData.id,
        device_info: 'iPhone 14',
        problem_description: 'Issue',
      };

      await request(app.getHttpServer()).post('/repair-orders').send(createDto).expect(401);
    });
  });

  describe('GET /repair-orders - List Repair Orders', () => {
    beforeEach(async () => {
      // Create test repair orders
      for (let i = 0; i < 5; i++) {
        await RepairOrderFactory.create(knex, {
          user_id: userData.id,
          branch_id: branchData.id,
          created_by: adminData.id,
          device_info: `Device ${i}`,
        });
      }
    });

    it('should return paginated repair orders', async () => {
      const response = await request(app.getHttpServer())
        .get('/repair-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 3, offset: 0 })
        .expect(200);

      expect(response.body).toHaveProperty('Open');
      expect(Array.isArray(response.body.Open)).toBe(true);
      expect(response.body.Open.length).toBeLessThanOrEqual(3);
    });

    it('should filter by status', async () => {
      await request(app.getHttpServer())
        .get('/repair-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ status: 'Open' })
        .expect(200);
    });

    it('should filter by date range', async () => {
      const from = new Date('2024-01-01').toISOString();
      const to = new Date().toISOString();

      await request(app.getHttpServer())
        .get('/repair-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ created_from: from, created_to: to })
        .expect(200);
    });

    it('should search by device info', async () => {
      await request(app.getHttpServer())
        .get('/repair-orders')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ search: 'iPhone' })
        .expect(200);
    });
  });

  describe('GET /repair-orders/:id - Get Single Repair Order', () => {
    beforeEach(async () => {
      const repairOrder = await RepairOrderFactory.create(knex, {
        user_id: userData.id,
        branch_id: branchData.id,
        created_by: adminData.id,
      });
      repairOrderId = repairOrder.id;
    });

    it('should return repair order details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/repair-orders/${repairOrderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', repairOrderId);
      expect(response.body).toHaveProperty('device_info');
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('branch');
    });

    it('should return 404 for non-existent repair order', async () => {
      await request(app.getHttpServer())
        .get('/repair-orders/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PATCH /repair-orders/:id - Update Repair Order', () => {
    beforeEach(async () => {
      const repairOrder = await RepairOrderFactory.create(knex, {
        user_id: userData.id,
        branch_id: branchData.id,
        created_by: adminData.id,
      });
      repairOrderId = repairOrder.id;
    });

    it('should update repair order successfully', async () => {
      const updateDto = {
        problem_description: 'Updated problem description',
        estimated_cost: 399.99,
      };

      const response = await request(app.getHttpServer())
        .patch(`/repair-orders/${repairOrderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Repair order updated successfully');

      // Verify database update
      const dbRecord = await knex('repair_orders').where({ id: repairOrderId }).first();
      expect(dbRecord.problem_description).toBe(updateDto.problem_description);
      expect(parseFloat(dbRecord.estimated_cost)).toBe(updateDto.estimated_cost);
      expect(dbRecord.updated_by).toBe(adminData.id);
    });

    it('should validate update data', async () => {
      const invalidDto = {
        estimated_cost: 'invalid-number',
      };

      await request(app.getHttpServer())
        .patch(`/repair-orders/${repairOrderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidDto)
        .expect(400);
    });
  });

  describe('PATCH /repair-orders/:id/move - Move Repair Order', () => {
    beforeEach(async () => {
      const repairOrder = await RepairOrderFactory.create(knex, {
        user_id: userData.id,
        branch_id: branchData.id,
        created_by: adminData.id,
      });
      repairOrderId = repairOrder.id;
    });

    it('should move repair order to different status', async () => {
      const moveDto = {
        status_id: 'new-status-id',
        notes: 'Moving to in progress',
      };

      const response = await request(app.getHttpServer())
        .patch(`/repair-orders/${repairOrderId}/move`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(moveDto)
        .expect(200);

      expect(response.body).toHaveProperty('message');

      // Verify status change in database
      const dbRecord = await knex('repair_orders').where({ id: repairOrderId }).first();
      expect(dbRecord.status_id).toBe(moveDto.status_id);
    });
  });

  describe('PATCH /repair-orders/:id/sort - Update Sort Order', () => {
    beforeEach(async () => {
      const repairOrder = await RepairOrderFactory.create(knex, {
        user_id: userData.id,
        branch_id: branchData.id,
        created_by: adminData.id,
      });
      repairOrderId = repairOrder.id;
    });

    it('should update sort order successfully', async () => {
      const sortDto = {
        sort_order: 5,
      };

      await request(app.getHttpServer())
        .patch(`/repair-orders/${repairOrderId}/sort`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(sortDto)
        .expect(200);

      // Verify sort order update
      const dbRecord = await knex('repair_orders').where({ id: repairOrderId }).first();
      expect(dbRecord.sort_order).toBe(sortDto.sort_order);
    });
  });

  describe('PATCH /repair-orders/:id/client-info - Update Client Info', () => {
    beforeEach(async () => {
      const repairOrder = await RepairOrderFactory.create(knex, {
        user_id: userData.id,
        branch_id: branchData.id,
        created_by: adminData.id,
      });
      repairOrderId = repairOrder.id;
    });

    it('should update client information', async () => {
      const clientInfoDto = {
        client_name: 'Updated Client Name',
        client_phone: '+9998887766',
        client_email: 'updated@example.com',
      };

      const response = await request(app.getHttpServer())
        .patch(`/repair-orders/${repairOrderId}/client-info`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(clientInfoDto)
        .expect(200);

      expect(response.body).toHaveProperty('message');

      // Verify client info update
      const dbRecord = await knex('repair_orders').where({ id: repairOrderId }).first();
      expect(dbRecord.client_name).toBe(clientInfoDto.client_name);
      expect(dbRecord.client_phone).toBe(clientInfoDto.client_phone);
    });
  });

  describe('PATCH /repair-orders/:id/product - Update Product Info', () => {
    beforeEach(async () => {
      const repairOrder = await RepairOrderFactory.create(knex, {
        user_id: userData.id,
        branch_id: branchData.id,
        created_by: adminData.id,
      });
      repairOrderId = repairOrder.id;
    });

    it('should update product information', async () => {
      const productDto = {
        device_info: 'Updated iPhone 15 Pro',
        brand: 'Apple',
        model: 'iPhone 15 Pro',
      };

      const response = await request(app.getHttpServer())
        .patch(`/repair-orders/${repairOrderId}/product`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(productDto)
        .expect(200);

      expect(response.body).toHaveProperty('message');

      // Verify product info update
      const dbRecord = await knex('repair_orders').where({ id: repairOrderId }).first();
      expect(dbRecord.device_info).toBe(productDto.device_info);
      expect(dbRecord.brand).toBe(productDto.brand);
    });
  });

  describe('PATCH /repair-orders/:id/problem - Update Problem Info', () => {
    beforeEach(async () => {
      const repairOrder = await RepairOrderFactory.create(knex, {
        user_id: userData.id,
        branch_id: branchData.id,
        created_by: adminData.id,
      });
      repairOrderId = repairOrder.id;
    });

    it('should update problem information', async () => {
      const problemDto = {
        initial_problem: 'Updated initial problem',
        final_problem: 'Final diagnosis',
        estimated_cost: 450.0,
      };

      const response = await request(app.getHttpServer())
        .patch(`/repair-orders/${repairOrderId}/problem`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(problemDto)
        .expect(200);

      expect(response.body).toHaveProperty('message');

      // Verify problem info update
      const dbRecord = await knex('repair_orders').where({ id: repairOrderId }).first();
      expect(dbRecord.initial_problem).toBe(problemDto.initial_problem);
      expect(dbRecord.final_problem).toBe(problemDto.final_problem);
    });
  });

  describe('PATCH /repair-orders/:id/transfer-branch - Transfer Branch', () => {
    beforeEach(async () => {
      const repairOrder = await RepairOrderFactory.create(knex, {
        user_id: userData.id,
        branch_id: branchData.id,
        created_by: adminData.id,
      });
      repairOrderId = repairOrder.id;
    });

    it('should transfer repair order to different branch', async () => {
      const newBranch = await BranchFactory.create(knex);
      const transferDto = {
        new_branch_id: newBranch.id,
        transfer_reason: 'Better equipped branch',
      };

      const response = await request(app.getHttpServer())
        .patch(`/repair-orders/${repairOrderId}/transfer-branch`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(transferDto)
        .expect(200);

      expect(response.body).toHaveProperty('message');

      // Verify branch transfer
      const dbRecord = await knex('repair_orders').where({ id: repairOrderId }).first();
      expect(dbRecord.branch_id).toBe(newBranch.id);
    });
  });

  describe('Repair Order Sub-Controllers - Comments', () => {
    beforeEach(async () => {
      const repairOrder = await RepairOrderFactory.create(knex, {
        user_id: userData.id,
        branch_id: branchData.id,
        created_by: adminData.id,
      });
      repairOrderId = repairOrder.id;
    });

    it('should add comment to repair order', async () => {
      const commentDto = {
        comment_text: 'Customer called to check status',
        is_internal: false,
      };

      const response = await request(app.getHttpServer())
        .post(`/repair-orders/${repairOrderId}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(commentDto)
        .expect(201);

      expect(response.body).toHaveProperty('message');

      // Verify comment in database
      const dbComment = await knex('repair_order_comments')
        .where({ repair_order_id: repairOrderId })
        .first();
      expect(dbComment.comment_text).toBe(commentDto.comment_text);
      expect(dbComment.created_by).toBe(adminData.id);
    });

    it('should get comments for repair order', async () => {
      // Add a comment first
      await knex('repair_order_comments').insert({
        repair_order_id: repairOrderId,
        comment_text: 'Test comment',
        is_internal: false,
        created_by: adminData.id,
        created_at: new Date(),
      });

      const response = await request(app.getHttpServer())
        .get(`/repair-orders/${repairOrderId}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should update comment', async () => {
      // Create comment
      const [commentId] = await knex('repair_order_comments')
        .insert({
          repair_order_id: repairOrderId,
          comment_text: 'Original comment',
          is_internal: false,
          created_by: adminData.id,
          created_at: new Date(),
        })
        .returning('id');

      const updateDto = {
        comment_text: 'Updated comment text',
      };

      const response = await request(app.getHttpServer())
        .patch(`/repair-orders/${repairOrderId}/comments/${commentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });

    it('should delete comment', async () => {
      // Create comment
      const [commentId] = await knex('repair_order_comments')
        .insert({
          repair_order_id: repairOrderId,
          comment_text: 'Comment to delete',
          is_internal: false,
          created_by: adminData.id,
          created_at: new Date(),
        })
        .returning('id');

      await request(app.getHttpServer())
        .delete(`/repair-orders/${repairOrderId}/comments/${commentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify comment is soft deleted
      const deletedComment = await knex('repair_order_comments').where({ id: commentId }).first();
      expect(deletedComment.deleted_at).toBeTruthy();
    });
  });

  describe('Repair Order Sub-Controllers - Attachments', () => {
    beforeEach(async () => {
      const repairOrder = await RepairOrderFactory.create(knex, {
        user_id: userData.id,
        branch_id: branchData.id,
        created_by: adminData.id,
      });
      repairOrderId = repairOrder.id;
    });

    it('should upload attachment to repair order', async () => {
      const response = await request(app.getHttpServer())
        .post(`/repair-orders/${repairOrderId}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from('fake file content'), 'test-image.jpg')
        .field('description', 'Device damage photo')
        .expect(201);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('file_url');

      // Verify attachment in database
      const dbAttachment = await knex('repair_order_attachments')
        .where({ repair_order_id: repairOrderId })
        .first();
      expect(dbAttachment.description).toBe('Device damage photo');
      expect(dbAttachment.created_by).toBe(adminData.id);
    });

    it('should get attachments for repair order', async () => {
      // Add attachment first
      await knex('repair_order_attachments').insert({
        repair_order_id: repairOrderId,
        file_name: 'test.jpg',
        file_path: '/uploads/test.jpg',
        description: 'Test attachment',
        created_by: adminData.id,
        created_at: new Date(),
      });

      const response = await request(app.getHttpServer())
        .get(`/repair-orders/${repairOrderId}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should delete attachment', async () => {
      // Create attachment
      const [attachmentId] = await knex('repair_order_attachments')
        .insert({
          repair_order_id: repairOrderId,
          file_name: 'test.jpg',
          file_path: '/uploads/test.jpg',
          description: 'Test attachment',
          created_by: adminData.id,
          created_at: new Date(),
        })
        .returning('id');

      await request(app.getHttpServer())
        .delete(`/repair-orders/${repairOrderId}/attachments/${attachmentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify attachment is soft deleted
      const deletedAttachment = await knex('repair_order_attachments')
        .where({ id: attachmentId })
        .first();
      expect(deletedAttachment.deleted_at).toBeTruthy();
    });
  });

  describe('Repair Order Sub-Controllers - Admin Assignment', () => {
    beforeEach(async () => {
      const repairOrder = await RepairOrderFactory.create(knex, {
        user_id: userData.id,
        branch_id: branchData.id,
        created_by: adminData.id,
      });
      repairOrderId = repairOrder.id;
    });

    it('should assign admin to repair order', async () => {
      const newAdmin = await AdminFactory.create(knex, { branch_id: branchData.id });
      const assignDto = {
        admin_id: newAdmin.id,
      };

      const response = await request(app.getHttpServer())
        .patch(`/repair-orders/${repairOrderId}/assign-admin`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(assignDto)
        .expect(200);

      expect(response.body).toHaveProperty('message');

      // Verify assignment in database
      const dbRecord = await knex('repair_orders').where({ id: repairOrderId }).first();
      expect(dbRecord.assigned_admin_id).toBe(newAdmin.id);
    });

    it('should unassign admin from repair order', async () => {
      // First assign an admin
      await knex('repair_orders')
        .where({ id: repairOrderId })
        .update({ assigned_admin_id: adminData.id });

      const response = await request(app.getHttpServer())
        .patch(`/repair-orders/${repairOrderId}/unassign-admin`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');

      // Verify unassignment
      const dbRecord = await knex('repair_orders').where({ id: repairOrderId }).first();
      expect(dbRecord.assigned_admin_id).toBeNull();
    });
  });

  describe('Repair Order Sub-Controllers - Pickup', () => {
    beforeEach(async () => {
      const repairOrder = await RepairOrderFactory.create(knex, {
        user_id: userData.id,
        branch_id: branchData.id,
        created_by: adminData.id,
        status_id: 'completed-status-id',
      });
      repairOrderId = repairOrder.id;
    });

    it('should register device pickup', async () => {
      const pickupDto = {
        pickup_notes: 'Device picked up by customer',
        picked_up_by: 'John Doe',
      };

      const response = await request(app.getHttpServer())
        .patch(`/repair-orders/${repairOrderId}/pickup`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(pickupDto)
        .expect(200);

      expect(response.body).toHaveProperty('message');

      // Verify pickup in database
      const dbRecord = await knex('repair_orders').where({ id: repairOrderId }).first();
      expect(dbRecord.pickup_notes).toBe(pickupDto.pickup_notes);
      expect(dbRecord.picked_up_at).toBeTruthy();
    });
  });

  describe('Repair Order Sub-Controllers - Delivery', () => {
    beforeEach(async () => {
      const repairOrder = await RepairOrderFactory.create(knex, {
        user_id: userData.id,
        branch_id: branchData.id,
        created_by: adminData.id,
        status_id: 'completed-status-id',
      });
      repairOrderId = repairOrder.id;
    });

    it('should register device delivery', async () => {
      const deliveryDto = {
        delivery_address: '123 Main St, City',
        delivery_notes: 'Delivered to customer',
        courier_name: 'Express Delivery',
      };

      const response = await request(app.getHttpServer())
        .patch(`/repair-orders/${repairOrderId}/delivery`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(deliveryDto)
        .expect(200);

      expect(response.body).toHaveProperty('message');

      // Verify delivery in database
      const dbRecord = await knex('repair_orders').where({ id: repairOrderId }).first();
      expect(dbRecord.delivery_address).toBe(deliveryDto.delivery_address);
      expect(dbRecord.delivered_at).toBeTruthy();
    });
  });

  describe('Repair Order Sub-Controllers - Rental Phone', () => {
    beforeEach(async () => {
      const repairOrder = await RepairOrderFactory.create(knex, {
        user_id: userData.id,
        branch_id: branchData.id,
        created_by: adminData.id,
      });
      repairOrderId = repairOrder.id;
    });

    it('should assign rental phone to repair order', async () => {
      const rentalDto = {
        rental_phone_id: 'rental-phone-id',
        rental_notes: 'iPhone 12 loaner device',
      };

      const response = await request(app.getHttpServer())
        .patch(`/repair-orders/${repairOrderId}/rental-phone`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(rentalDto)
        .expect(200);

      expect(response.body).toHaveProperty('message');

      // Verify rental phone assignment
      const dbRecord = await knex('repair_orders').where({ id: repairOrderId }).first();
      expect(dbRecord.rental_phone_id).toBe(rentalDto.rental_phone_id);
    });

    it('should return rental phone', async () => {
      // First assign a rental phone
      await knex('repair_orders')
        .where({ id: repairOrderId })
        .update({ rental_phone_id: 'rental-phone-id' });

      const returnDto = {
        return_notes: 'Phone returned in good condition',
      };

      const response = await request(app.getHttpServer())
        .patch(`/repair-orders/${repairOrderId}/rental-phone/return`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(returnDto)
        .expect(200);

      expect(response.body).toHaveProperty('message');

      // Verify rental phone return
      const dbRecord = await knex('repair_orders').where({ id: repairOrderId }).first();
      expect(dbRecord.rental_phone_returned_at).toBeTruthy();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid UUID formats', async () => {
      await request(app.getHttpServer())
        .get('/repair-orders/invalid-uuid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should handle non-existent repair order IDs', async () => {
      const nonExistentId = '12345678-1234-1234-1234-123456789012';

      await request(app.getHttpServer())
        .get(`/repair-orders/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should handle permission violations', async () => {
      // This would test branch-level permissions
      const otherBranch = await BranchFactory.create(knex);
      const otherAdmin = await AdminFactory.create(knex, { branch_id: otherBranch.id });
      const otherToken = await TestHelpers.authenticateAdmin(app, otherAdmin);

      const repairOrder = await RepairOrderFactory.create(knex, {
        user_id: userData.id,
        branch_id: branchData.id,
        created_by: adminData.id,
      });

      await request(app.getHttpServer())
        .get(`/repair-orders/${repairOrder.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });

    it('should handle concurrent updates', async () => {
      const repairOrder = await RepairOrderFactory.create(knex, {
        user_id: userData.id,
        branch_id: branchData.id,
        created_by: adminData.id,
      });

      const updateDto = {
        problem_description: 'Concurrent update test',
      };

      // Multiple simultaneous updates
      const promises = Array(3)
        .fill(null)
        .map(() =>
          request(app.getHttpServer())
            .patch(`/repair-orders/${repairOrder.id}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send(updateDto),
        );

      const responses = await Promise.all(promises);

      // At least one should succeed
      const successful = responses.filter((r) => r.status === 200);
      expect(successful.length).toBeGreaterThan(0);
    });
  });

  describe('Data Integrity and Validation', () => {
    it('should maintain audit trail for all operations', async () => {
      const repairOrder = await RepairOrderFactory.create(knex, {
        user_id: userData.id,
        branch_id: branchData.id,
        created_by: adminData.id,
      });

      // Perform several operations
      await request(app.getHttpServer())
        .patch(`/repair-orders/${repairOrder.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ problem_description: 'Updated description' });

      await request(app.getHttpServer())
        .patch(`/repair-orders/${repairOrder.id}/move`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status_id: 'new-status-id' });

      // Verify audit trail
      const auditRecords = await knex('repair_order_history')
        .where({ repair_order_id: repairOrder.id })
        .orderBy('created_at', 'asc');

      expect(auditRecords.length).toBeGreaterThan(0);
      expect(auditRecords[0]).toHaveProperty('changed_by', adminData.id);
    });

    it('should validate business rules', async () => {
      const repairOrder = await RepairOrderFactory.create(knex, {
        user_id: userData.id,
        branch_id: branchData.id,
        created_by: adminData.id,
        status_id: 'closed-status-id',
      });

      // Try to update a closed repair order
      const response = await request(app.getHttpServer())
        .patch(`/repair-orders/${repairOrder.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ problem_description: 'Should not be allowed' });

      expect([400, 403, 409]).toContain(response.status);
    });
  });
});
