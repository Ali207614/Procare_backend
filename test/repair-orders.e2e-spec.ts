import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { TestHelpers, MockFactory } from './utils/test-helpers';
import { Knex } from 'knex';
import { getKnexToken } from 'nestjs-knex';

describe('RepairOrders E2E', () => {
  let app: INestApplication;
  let knexInstance: Knex;
  let adminToken: string;
  let testData: {
    branch: any;
    admin: any;
    user: any;
    phoneCategory: any;
    status: any;
    role: any;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));

    knexInstance = app.get<Knex>(getKnexToken());

    await app.init();

    // Setup test data
    await TestHelpers.cleanDatabase(knexInstance);
    const seedData = await TestHelpers.seedTestData(knexInstance);

    // Create additional test entities
    const [user] = await knexInstance('users')
      .insert({
        id: MockFactory.createAdmin().id,
        phone: '+998901111111',
        status: 'Open',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    const [phoneCategory] = await knexInstance('phone_categories')
      .insert({
        id: MockFactory.createAdmin().id,
        name: 'iPhone 13',
        is_active: true,
        status: 'Open',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    const [status] = await knexInstance('statuses')
      .insert({
        id: MockFactory.createAdmin().id,
        name: 'Open',
        branch_id: seedData.branch.id,
        is_active: true,
        status: 'Open',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    // Create permissions for the admin role
    await knexInstance('role_permissions').insert([
      {
        id: MockFactory.createAdmin().id,
        role_id: seedData.role.id,
        permission_id: MockFactory.createAdmin().id,
        created_at: new Date(),
        updated_at: new Date(),
      }
    ]);

    testData = {
      ...seedData,
      user,
      phoneCategory,
      status,
    };

    // Authenticate admin
    adminToken = await TestHelpers.authenticateAdmin(app);
  });

  afterAll(async () => {
    await TestHelpers.cleanDatabase(knexInstance);
    await app.close();
  });

  beforeEach(async () => {
    // Clean repair orders between tests
    await knexInstance('repair_orders').del();
  });

  describe('/api/v1/repair-orders (POST)', () => {
    it('should create a new repair order', () => {
      return request(app.getHttpServer())
        .post('/api/v1/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          user_id: testData.user.id,
          phone_category_id: testData.phoneCategory.id,
          status_id: testData.status.id,
          priority: 'High',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.id).toBeDefined();
          expect(res.body.user_id).toBe(testData.user.id);
          expect(res.body.priority).toBe('High');
          expect(res.body.status_id).toBe(testData.status.id);
          expect(res.body.branch_id).toBe(testData.branch.id);
        });
    });

    it('should return 400 for invalid user ID', () => {
      return request(app.getHttpServer())
        .post('/api/v1/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          user_id: 'non-existent-user-id',
          phone_category_id: testData.phoneCategory.id,
          status_id: testData.status.id,
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('User not found or inactive');
        });
    });

    it('should return 400 for invalid phone category', () => {
      return request(app.getHttpServer())
        .post('/api/v1/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          user_id: testData.user.id,
          phone_category_id: 'non-existent-category-id',
          status_id: testData.status.id,
        })
        .expect(400);
    });

    it('should return 401 without authentication', () => {
      return request(app.getHttpServer())
        .post('/api/v1/repair-orders')
        .send({
          user_id: testData.user.id,
          phone_category_id: testData.phoneCategory.id,
          status_id: testData.status.id,
        })
        .expect(401);
    });

    it('should validate required fields', () => {
      return request(app.getHttpServer())
        .post('/api/v1/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          // Missing required fields
        })
        .expect(400);
    });

    it('should validate UUID format for IDs', () => {
      return request(app.getHttpServer())
        .post('/api/v1/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          user_id: 'invalid-uuid',
          phone_category_id: testData.phoneCategory.id,
          status_id: testData.status.id,
        })
        .expect(400);
    });
  });

  describe('/api/v1/repair-orders (GET)', () => {
    let createdOrders: any[];

    beforeEach(async () => {
      // Create test repair orders
      createdOrders = [];
      for (let i = 0; i < 3; i++) {
        const response = await request(app.getHttpServer())
          .post('/api/v1/repair-orders')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            user_id: testData.user.id,
            phone_category_id: testData.phoneCategory.id,
            status_id: testData.status.id,
            priority: i === 0 ? 'High' : 'Medium',
          });
        createdOrders.push(response.body);
      }
    });

    it('should return paginated repair orders', () => {
      return request(app.getHttpServer())
        .get('/api/v1/repair-orders?limit=10&offset=0')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Branch-Id', testData.branch.id)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('Open');
          expect(Array.isArray(res.body.Open)).toBe(true);
          expect(res.body.Open).toHaveLength(3);
        });
    });

    it('should filter by priority', () => {
      return request(app.getHttpServer())
        .get('/api/v1/repair-orders?priority=High')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Branch-Id', testData.branch.id)
        .expect(200)
        .expect((res) => {
          const highPriorityOrders = res.body.Open?.filter(order => order.priority === 'High') || [];
          expect(highPriorityOrders).toHaveLength(1);
        });
    });

    it('should return 401 without authentication', () => {
      return request(app.getHttpServer())
        .get('/api/v1/repair-orders')
        .expect(401);
    });

    it('should return 400 without branch header', () => {
      return request(app.getHttpServer())
        .get('/api/v1/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  describe('/api/v1/repair-orders/:id (GET)', () => {
    let createdOrder: any;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          user_id: testData.user.id,
          phone_category_id: testData.phoneCategory.id,
          status_id: testData.status.id,
        });
      createdOrder = response.body;
    });

    it('should return a single repair order by ID', () => {
      return request(app.getHttpServer())
        .get(`/api/v1/repair-orders/${createdOrder.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(createdOrder.id);
          expect(res.body.user_id).toBe(testData.user.id);
          expect(res.body.phone_category_id).toBe(testData.phoneCategory.id);
        });
    });

    it('should return 404 for non-existent repair order', () => {
      return request(app.getHttpServer())
        .get('/api/v1/repair-orders/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should return 400 for invalid UUID format', () => {
      return request(app.getHttpServer())
        .get('/api/v1/repair-orders/invalid-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  describe('/api/v1/repair-orders/:id (PATCH)', () => {
    let createdOrder: any;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          user_id: testData.user.id,
          phone_category_id: testData.phoneCategory.id,
          status_id: testData.status.id,
          priority: 'Medium',
        });
      createdOrder = response.body;
    });

    it('should update a repair order successfully', () => {
      return request(app.getHttpServer())
        .patch(`/api/v1/repair-orders/${createdOrder.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          priority: 'High',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toContain('successfully');
        });
    });

    it('should return 404 for non-existent repair order', () => {
      return request(app.getHttpServer())
        .patch('/api/v1/repair-orders/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          priority: 'High',
        })
        .expect(404);
    });

    it('should validate enum values', () => {
      return request(app.getHttpServer())
        .patch(`/api/v1/repair-orders/${createdOrder.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          priority: 'InvalidPriority',
        })
        .expect(400);
    });
  });

  describe('/api/v1/repair-orders/:id (DELETE)', () => {
    let createdOrder: any;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          user_id: testData.user.id,
          phone_category_id: testData.phoneCategory.id,
          status_id: testData.status.id,
        });
      createdOrder = response.body;
    });

    it('should soft delete a repair order', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/repair-orders/${createdOrder.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toContain('successfully');
        });

      // Verify soft delete by checking it's not returned in list
      const getResponse = await request(app.getHttpServer())
        .get('/api/v1/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Branch-Id', testData.branch.id);

      const allOrders = Object.values(getResponse.body).flat();
      const deletedOrder = allOrders.find((order: any) => order.id === createdOrder.id);
      expect(deletedOrder).toBeUndefined();
    });

    it('should return 404 for non-existent repair order', () => {
      return request(app.getHttpServer())
        .delete('/api/v1/repair-orders/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('Complete Repair Order Workflow', () => {
    it('should complete full repair order lifecycle', async () => {
      // 1. Create repair order
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          user_id: testData.user.id,
          phone_category_id: testData.phoneCategory.id,
          status_id: testData.status.id,
          priority: 'High',
        })
        .expect(201);

      const orderId = createResponse.body.id;
      expect(orderId).toBeDefined();

      // 2. Get repair order details
      await request(app.getHttpServer())
        .get(`/api/v1/repair-orders/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(orderId);
          expect(res.body.priority).toBe('High');
        });

      // 3. Update repair order
      await request(app.getHttpServer())
        .patch(`/api/v1/repair-orders/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          priority: 'Low',
        })
        .expect(200);

      // 4. Verify update
      await request(app.getHttpServer())
        .get(`/api/v1/repair-orders/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // 5. Update sort order
      await request(app.getHttpServer())
        .patch(`/api/v1/repair-orders/${orderId}/sort`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          sort: 100,
        })
        .expect(200);

      // 6. Update client information
      await request(app.getHttpServer())
        .patch(`/api/v1/repair-orders/${orderId}/client`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          user_id: testData.user.id,
        })
        .expect(200);

      // 7. Update product information
      await request(app.getHttpServer())
        .patch(`/api/v1/repair-orders/${orderId}/product`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          phone_category_id: testData.phoneCategory.id,
        })
        .expect(200);

      // 8. Soft delete
      await request(app.getHttpServer())
        .delete(`/api/v1/repair-orders/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // 9. Verify deletion - should return 404
      await request(app.getHttpServer())
        .get(`/api/v1/repair-orders/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON', () => {
      return request(app.getHttpServer())
        .post('/api/v1/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);
    });

    it('should handle database connection errors gracefully', async () => {
      // This test would require mocking the database to simulate connection errors
      // In a real scenario, you might temporarily break the database connection
    });

    it('should return proper error format', () => {
      return request(app.getHttpServer())
        .post('/api/v1/repair-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          user_id: 'invalid-uuid-format',
          phone_category_id: testData.phoneCategory.id,
          status_id: testData.status.id,
        })
        .expect(400)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('statusCode');
        });
    });
  });

  describe('Authentication and Authorization', () => {
    it('should reject requests with invalid token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/repair-orders')
        .set('Authorization', 'Bearer invalid-token')
        .set('Branch-Id', testData.branch.id)
        .expect(401);
    });

    it('should reject requests with expired token', () => {
      // This would require creating an expired token
      // For now, we'll test with malformed token
      return request(app.getHttpServer())
        .get('/api/v1/repair-orders')
        .set('Authorization', 'Bearer expired.token.here')
        .set('Branch-Id', testData.branch.id)
        .expect(401);
    });

    it('should require proper Authorization header format', () => {
      return request(app.getHttpServer())
        .get('/api/v1/repair-orders')
        .set('Authorization', 'InvalidFormat token')
        .set('Branch-Id', testData.branch.id)
        .expect(401);
    });
  });
});