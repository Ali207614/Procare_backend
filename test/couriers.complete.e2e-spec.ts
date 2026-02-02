import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { CouriersService } from '../src/couriers/couriers.service';
import { AuthService } from '../src/auth/auth.service';
import { TestModuleBuilder } from './utils/test-module-builder';
import { CoverageHelpers } from './utils/coverage-helpers';

describe('Couriers Controller Complete E2E', () => {
  let app: INestApplication;
  let authService: AuthService;
  let couriersService: CouriersService;
  let knex: any;
  let redis: any;
  let adminToken: string;
  let testAdmin: any;
  let testBranch: any;
  let secondTestBranch: any;
  let testCouriers: any[];

  beforeAll(async () => {
    const moduleBuilder = new TestModuleBuilder();
    const module: TestingModule = await moduleBuilder
      .withRealDatabase()
      .withRealRedis()
      .withExternalServiceMocks()
      .build();

    app = module.createNestApplication();
    await app.init();

    // Get services
    authService = module.get<AuthService>(AuthService);
    couriersService = module.get<CouriersService>(CouriersService);
    knex = module.get('KNEX_CONNECTION');
    redis = module.get('REDIS_CLIENT');

    // Clean database and cache
    await knex.raw('DELETE FROM couriers');
    await knex.raw('DELETE FROM admin_role_permissions');
    await knex.raw('DELETE FROM role_permissions');
    await knex.raw('DELETE FROM admin_roles');
    await knex.raw('DELETE FROM admins');
    await knex.raw('DELETE FROM roles');
    await knex.raw('DELETE FROM permissions');
    await knex.raw('DELETE FROM branches');
    await redis.flushall();

    // Setup test data
    await setupTestData();
  });

  afterAll(async () => {
    // Clean up
    await knex.raw('DELETE FROM couriers');
    await knex.raw('DELETE FROM admin_role_permissions');
    await knex.raw('DELETE FROM role_permissions');
    await knex.raw('DELETE FROM admin_roles');
    await knex.raw('DELETE FROM admins');
    await knex.raw('DELETE FROM roles');
    await knex.raw('DELETE FROM permissions');
    await knex.raw('DELETE FROM branches');
    await redis.flushall();
    await app.close();
  });

  async function setupTestData() {
    // Create test branches
    testBranch = await knex('branches')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        name: 'Test Branch',
        address: 'Test Address',
        phone: '+998901234567',
        status: 'Open',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    testBranch = testBranch[0];

    secondTestBranch = await knex('branches')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        name: 'Second Test Branch',
        address: 'Second Test Address',
        phone: '+998902345678',
        status: 'Open',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    secondTestBranch = secondTestBranch[0];

    // Create test role with basic permissions
    const testRole = await knex('roles')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        name: 'Test Role',
        description: 'Role for testing',
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    const role = testRole[0];

    // Create test admin
    testAdmin = await knex('admins')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        first_name: 'Test',
        last_name: 'Admin',
        phone: '+998901111111',
        login: 'testadmin',
        password: '$2b$10$K7L/VxwjnydKw.fK8tUqme7kk7IgJ9J9J9J9J9J9J9J9J9J9J9J9',
        branch_id: testBranch.id,
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    testAdmin = testAdmin[0];

    // Assign role to admin
    await knex('admin_roles').insert({
      id: knex.raw('gen_random_uuid()'),
      admin_id: testAdmin.id,
      role_id: role.id,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Create test couriers
    testCouriers = [];
    const courierData = [
      {
        name: 'John Courier',
        phone: '+998903000001',
        email: 'john@courier.com',
        branch_id: testBranch.id,
      },
      {
        name: 'Jane Courier',
        phone: '+998903000002',
        email: 'jane@courier.com',
        branch_id: testBranch.id,
      },
      {
        name: 'Bob Courier',
        phone: '+998903000003',
        email: 'bob@courier.com',
        branch_id: testBranch.id,
      },
      {
        name: 'Alice Courier',
        phone: '+998903000004',
        email: 'alice@courier.com',
        branch_id: secondTestBranch.id,
      },
      {
        name: 'Mike Courier',
        phone: '+998903000005',
        email: 'mike@courier.com',
        branch_id: secondTestBranch.id,
      },
    ];

    for (const courier of courierData) {
      const createdCourier = await knex('couriers')
        .insert({
          id: knex.raw('gen_random_uuid()'),
          name: courier.name,
          phone: courier.phone,
          email: courier.email,
          branch_id: courier.branch_id,
          status: 'Active',
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('*');
      testCouriers.push(createdCourier[0]);
    }

    // Generate admin token
    adminToken = authService.generateJwtToken({
      id: testAdmin.id,
      login: testAdmin.login,
      first_name: testAdmin.first_name,
      last_name: testAdmin.last_name,
      phone: testAdmin.phone,
      branch_id: testAdmin.branch_id,
      status: testAdmin.status,
    });
  }

  describe('GET /api/v1/couriers (Get All Couriers)', () => {
    it('should return couriers for specified branch successfully', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/couriers?branch_id=${testBranch.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        data: expect.any(Array),
        meta: {
          total: expect.any(Number),
          limit: expect.any(Number),
          offset: expect.any(Number),
        },
      });

      expect(response.body.data.length).toBe(3); // 3 couriers for test branch
      expect(response.body.meta.total).toBe(3);

      // Verify courier structure
      const courier = response.body.data[0];
      expect(courier).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        phone: expect.any(String),
        email: expect.any(String),
        branch_id: testBranch.id,
        status: expect.any(String),
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });

      // All couriers should belong to the requested branch
      response.body.data.forEach((courier) => {
        expect(courier.branch_id).toBe(testBranch.id);
      });
    });

    it('should return couriers for different branch', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/couriers?branch_id=${secondTestBranch.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.length).toBe(2); // 2 couriers for second test branch
      expect(response.body.meta.total).toBe(2);

      response.body.data.forEach((courier) => {
        expect(courier.branch_id).toBe(secondTestBranch.id);
      });
    });

    it('should search couriers by name', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/couriers?branch_id=${testBranch.id}&search=John`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].name).toBe('John Courier');
    });

    it('should search couriers by phone', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/couriers?branch_id=${testBranch.id}&search=+998903000002`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].phone).toBe('+998903000002');
    });

    it('should search couriers by email', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/couriers?branch_id=${testBranch.id}&search=bob@courier.com`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].email).toBe('bob@courier.com');
    });

    it('should search couriers case-insensitively', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/couriers?branch_id=${testBranch.id}&search=JANE`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].name).toBe('Jane Courier');
    });

    it('should paginate couriers correctly', async () => {
      const limit = 2;
      const offset = 1;

      const response = await request(app.getHttpServer())
        .get(`/api/v1/couriers?branch_id=${testBranch.id}&limit=${limit}&offset=${offset}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.meta.limit).toBe(limit);
      expect(response.body.meta.offset).toBe(offset);
      expect(response.body.data.length).toBeLessThanOrEqual(limit);
      expect(response.body.meta.total).toBe(3); // Total couriers in branch
    });

    it('should return empty results for branch with no couriers', async () => {
      // Create a branch with no couriers
      const emptyBranch = await knex('branches')
        .insert({
          id: knex.raw('gen_random_uuid()'),
          name: 'Empty Branch',
          address: 'Empty Address',
          phone: '+998904567890',
          status: 'Open',
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('*');

      const response = await request(app.getHttpServer())
        .get(`/api/v1/couriers?branch_id=${emptyBranch[0].id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(0);
      expect(response.body.meta.total).toBe(0);
    });

    it('should return empty results for non-matching search', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/couriers?branch_id=${testBranch.id}&search=NonExistentCourier`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(0);
      expect(response.body.meta.total).toBe(0);
    });

    it('should handle combined search and pagination', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/couriers?branch_id=${testBranch.id}&search=Courier&limit=2&offset=0`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(2);
      response.body.data.forEach((courier) => {
        expect(courier.name.toLowerCase()).toContain('courier');
      });
    });

    it('should fail when branch_id is missing', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/couriers')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should fail with invalid branch_id format', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/couriers?branch_id=invalid-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should fail with non-existent branch_id', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/couriers?branch_id=00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should fail with invalid limit parameter', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/couriers?branch_id=${testBranch.id}&limit=invalid`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should fail with invalid offset parameter', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/couriers?branch_id=${testBranch.id}&offset=invalid`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should handle large limit values', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/couriers?branch_id=${testBranch.id}&limit=1000`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.length).toBe(3); // Should return all couriers in branch
    });

    it('should handle zero offset', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/couriers?branch_id=${testBranch.id}&offset=0`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.meta.offset).toBe(0);
    });

    it('should handle large offset values', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/couriers?branch_id=${testBranch.id}&offset=999`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(0);
      expect(response.body.meta.total).toBe(3); // Total should still be correct
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/couriers?branch_id=${testBranch.id}`)
        .expect(401);
    });

    it('should fail with invalid JWT token', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/couriers?branch_id=${testBranch.id}`)
        .set('Authorization', 'Bearer invalid.jwt.token')
        .expect(401);
    });

    it('should fail with malformed Authorization header', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/couriers?branch_id=${testBranch.id}`)
        .set('Authorization', 'InvalidFormat token')
        .expect(401);
    });
  });

  describe('Database Consistency Verification', () => {
    it('should maintain referential integrity between couriers and branches', async () => {
      const couriers = await knex('couriers').select('*');
      const branches = await knex('branches').select('*');

      for (const courier of couriers) {
        const branch = branches.find((b) => b.id === courier.branch_id);
        expect(branch).toBeTruthy();
      }
    });

    it('should maintain audit fields correctly', async () => {
      const couriers = await knex('couriers').select('*');

      for (const courier of couriers) {
        expect(courier.created_at).toBeTruthy();
        expect(courier.updated_at).toBeTruthy();
        expect(new Date(courier.created_at)).toBeInstanceOf(Date);
        expect(new Date(courier.updated_at)).toBeInstanceOf(Date);
      }
    });

    it('should enforce unique constraints on phone numbers', async () => {
      try {
        await knex('couriers').insert({
          id: knex.raw('gen_random_uuid()'),
          name: 'Duplicate Phone',
          phone: testCouriers[0].phone, // Duplicate phone
          email: 'unique@courier.com',
          branch_id: testBranch.id,
          status: 'Active',
          created_at: new Date(),
          updated_at: new Date(),
        });
        fail('Should have thrown unique constraint error');
      } catch (error) {
        expect(error.code).toBe('23505'); // PostgreSQL unique constraint violation
      }
    });

    it('should enforce unique constraints on email addresses', async () => {
      try {
        await knex('couriers').insert({
          id: knex.raw('gen_random_uuid()'),
          name: 'Duplicate Email',
          phone: '+998909999999',
          email: testCouriers[0].email, // Duplicate email
          branch_id: testBranch.id,
          status: 'Active',
          created_at: new Date(),
          updated_at: new Date(),
        });
        fail('Should have thrown unique constraint error');
      } catch (error) {
        expect(error.code).toBe('23505'); // PostgreSQL unique constraint violation
      }
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle large result sets efficiently', async () => {
      // Create many couriers for performance testing
      const manyCouriers = [];
      for (let i = 1; i <= 50; i++) {
        manyCouriers.push({
          id: knex.raw('gen_random_uuid()'),
          name: `Performance Courier ${i}`,
          phone: `+99890${4000 + i}`,
          email: `performance${i}@courier.com`,
          branch_id: testBranch.id,
          status: 'Active',
          created_at: new Date(),
          updated_at: new Date(),
        });
      }

      await knex('couriers').insert(manyCouriers);

      const startTime = Date.now();

      await request(app.getHttpServer())
        .get(`/api/v1/couriers?branch_id=${testBranch.id}&limit=50`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(3000); // Should complete within 3 seconds
    });

    it('should handle concurrent requests efficiently', async () => {
      const promises = [];
      const requestCount = 10;

      for (let i = 0; i < requestCount; i++) {
        const promise = request(app.getHttpServer())
          .get(`/api/v1/couriers?branch_id=${testBranch.id}&limit=10`)
          .set('Authorization', `Bearer ${adminToken}`);
        promises.push(promise);
      }

      const results = await Promise.allSettled(promises);
      const successful = results.filter((r) => r.status === 'fulfilled' && r.value.status === 200);

      expect(successful.length).toBe(requestCount);
    });

    it('should handle complex search queries efficiently', async () => {
      const startTime = Date.now();

      await request(app.getHttpServer())
        .get(`/api/v1/couriers?branch_id=${testBranch.id}&search=courier&limit=20`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle very long search terms gracefully', async () => {
      const longSearchTerm = 'a'.repeat(1000);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/couriers?branch_id=${testBranch.id}&search=${longSearchTerm}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toEqual([]);
    });

    it('should handle special characters in search', async () => {
      const specialChars = 'john@#$%^&*()';

      const response = await request(app.getHttpServer())
        .get(
          `/api/v1/couriers?branch_id=${testBranch.id}&search=${encodeURIComponent(specialChars)}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Should handle gracefully without crashing
      expect(response.body).toMatchObject({
        data: expect.any(Array),
        meta: expect.any(Object),
      });
    });

    it('should handle Unicode characters in search', async () => {
      const unicodeSearch = 'тест用户';

      const response = await request(app.getHttpServer())
        .get(
          `/api/v1/couriers?branch_id=${testBranch.id}&search=${encodeURIComponent(unicodeSearch)}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toEqual(expect.any(Array));
    });

    it('should handle SQL injection attempts safely', async () => {
      const sqlInjection = "'; DROP TABLE couriers; --";

      const response = await request(app.getHttpServer())
        .get(
          `/api/v1/couriers?branch_id=${testBranch.id}&search=${encodeURIComponent(sqlInjection)}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Should handle safely without executing injection
      expect(response.body.data).toEqual(expect.any(Array));

      // Verify couriers table still exists by making another request
      await request(app.getHttpServer())
        .get(`/api/v1/couriers?branch_id=${testBranch.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should handle empty search parameter', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/couriers?branch_id=${testBranch.id}&search=`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Should return all couriers in branch when search is empty
      expect(response.body.data.length).toBe(3);
    });

    it('should handle null or undefined query parameters gracefully', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/couriers?branch_id=${testBranch.id}&search=null`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toEqual(expect.any(Array));
    });
  });

  describe('Security and Authorization', () => {
    it('should prevent unauthorized access without JWT token', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/couriers?branch_id=${testBranch.id}`)
        .expect(401);
    });

    it('should validate JWT token format', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/couriers?branch_id=${testBranch.id}`)
        .set('Authorization', 'Bearer invalid.jwt.token')
        .expect(401);
    });

    it('should not expose sensitive courier data', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/couriers?branch_id=${testBranch.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      response.body.data.forEach((courier) => {
        // Should not expose internal fields that might be sensitive
        expect(courier).not.toHaveProperty('password');
        expect(courier).not.toHaveProperty('internal_id');
        expect(courier).not.toHaveProperty('secret_key');
        expect(courier).not.toHaveProperty('deleted_at');
      });
    });

    it('should enforce branch-level access control', async () => {
      // Courier data should only be returned for the specified branch
      const response = await request(app.getHttpServer())
        .get(`/api/v1/couriers?branch_id=${testBranch.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      response.body.data.forEach((courier) => {
        expect(courier.branch_id).toBe(testBranch.id);
      });
    });
  });

  describe('API Response Format Validation', () => {
    it('should return consistent response format', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/couriers?branch_id=${testBranch.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({
          data: expect.any(Array),
          meta: expect.objectContaining({
            total: expect.any(Number),
            limit: expect.any(Number),
            offset: expect.any(Number),
          }),
        }),
      );

      response.body.data.forEach((courier) => {
        expect(courier).toEqual(
          expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
            phone: expect.any(String),
            email: expect.any(String),
            branch_id: expect.any(String),
            status: expect.any(String),
            created_at: expect.any(String),
            updated_at: expect.any(String),
          }),
        );

        // Validate UUID format for id
        expect(courier.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        );
        expect(courier.branch_id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        );

        // Validate date format
        expect(new Date(courier.created_at)).toBeInstanceOf(Date);
        expect(new Date(courier.updated_at)).toBeInstanceOf(Date);

        // Validate phone format
        expect(courier.phone).toMatch(/^\+998\d{9}$/);

        // Validate email format
        expect(courier.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      });
    });

    it('should return proper HTTP status codes', async () => {
      // Success case
      await request(app.getHttpServer())
        .get(`/api/v1/couriers?branch_id=${testBranch.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Unauthorized case
      await request(app.getHttpServer())
        .get(`/api/v1/couriers?branch_id=${testBranch.id}`)
        .expect(401);

      // Bad request case (missing branch_id)
      await request(app.getHttpServer())
        .get('/api/v1/couriers')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      // Not found case (non-existent branch)
      await request(app.getHttpServer())
        .get('/api/v1/couriers?branch_id=00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  afterEach(async () => {
    // Generate coverage report after each test suite
    await CoverageHelpers.generateCoverageReport();
  });
});
