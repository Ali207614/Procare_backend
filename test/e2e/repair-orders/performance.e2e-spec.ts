import { RepairOrderTestSetup } from './setup.e2e';

describe('Repair Orders - Performance and Scalability', () => {
  beforeAll(async () => {
    await RepairOrderTestSetup.setupApplication();
  });

  beforeEach(async () => {
    await RepairOrderTestSetup.cleanRepairOrderTables();
  });

  afterAll(async () => {
    await RepairOrderTestSetup.cleanupApplication();
  });

  describe('Bulk Operations Performance', () => {
    it('should handle bulk repair order creation efficiently', async () => {
      const startTime = Date.now();
      const promises = [];
      const batchSize = 10;

      // Create 10 repair orders concurrently
      for (let i = 0; i < batchSize; i++) {
        const createDto = await RepairOrderTestSetup.createValidRepairOrderDto({
          priority: i % 3 === 0 ? 'High' : i % 3 === 1 ? 'Medium' : 'Low',
        });
        promises.push(
          RepairOrderTestSetup.makeRequest()
            .post('/repair-orders')
            .set('Authorization', RepairOrderTestSetup.getAdminAuth())
            .query({
              branch_id: RepairOrderTestSetup.testData.branchData.id,
              status_id: RepairOrderTestSetup.testData.repairStatus.id,
            })
            .send(createDto),
        );
      }

      const responses = await Promise.all(promises);
      const endTime = Date.now();

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
      });

      // Should complete within reasonable time (10 seconds)
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(10000);

      console.log(`Bulk creation of ${batchSize} repair orders took ${executionTime}ms`);
    });

    it('should handle bulk status transitions efficiently', async () => {
      // First create multiple repair orders
      const repairOrderIds = [];
      for (let i = 0; i < 5; i++) {
        const createDto = await RepairOrderTestSetup.createValidRepairOrderDto();
        const response = await RepairOrderTestSetup.makeRequest()
          .post('/repair-orders')
          .set('Authorization', RepairOrderTestSetup.getAdminAuth())
          .query({
            branch_id: RepairOrderTestSetup.testData.branchData.id,
            status_id: RepairOrderTestSetup.testData.repairStatus.id,
          })
          .send(createDto);
        repairOrderIds.push(response.body.id);
      }

      // Now perform bulk status transitions
      const startTime = Date.now();
      const movePromises = repairOrderIds.map((id) =>
        RepairOrderTestSetup.makeRequest()
          .patch(`/repair-orders/${id}/move`)
          .set('Authorization', RepairOrderTestSetup.getAdminAuth())
          .query({ status_id: RepairOrderTestSetup.testData.inProgressStatus.id })
          .send({ notes: 'Bulk status move' }),
      );

      const responses = await Promise.all(movePromises);
      const endTime = Date.now();

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });

      // Should complete within reasonable time (5 seconds)
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(5000);

      console.log(
        `Bulk status transitions for ${repairOrderIds.length} orders took ${executionTime}ms`,
      );
    });

    it('should handle bulk updates efficiently', async () => {
      // Create multiple repair orders
      const repairOrderIds = [];
      for (let i = 0; i < 8; i++) {
        const createDto = await RepairOrderTestSetup.createValidRepairOrderDto();
        const response = await RepairOrderTestSetup.makeRequest()
          .post('/repair-orders')
          .set('Authorization', RepairOrderTestSetup.getAdminAuth())
          .query({
            branch_id: RepairOrderTestSetup.testData.branchData.id,
            status_id: RepairOrderTestSetup.testData.repairStatus.id,
          })
          .send(createDto);
        repairOrderIds.push(response.body.id);
      }

      // Perform bulk updates
      const startTime = Date.now();
      const updatePromises = repairOrderIds.map((id, index) =>
        RepairOrderTestSetup.makeRequest()
          .patch(`/repair-orders/${id}`)
          .set('Authorization', RepairOrderTestSetup.getAdminAuth())
          .send({
            priority: 'High',
            total: (index + 1) * 100000,
            imei: `12345678901234${index}`,
          }),
      );

      const responses = await Promise.all(updatePromises);
      const endTime = Date.now();

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });

      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(8000);

      console.log(`Bulk updates for ${repairOrderIds.length} orders took ${executionTime}ms`);
    });
  });

  describe('Pagination Performance', () => {
    it('should handle large pagination efficiently', async () => {
      const totalRecords = 50;

      // Create many repair orders
      const createPromises = [];
      for (let i = 0; i < totalRecords; i++) {
        const createDto = await RepairOrderTestSetup.createValidRepairOrderDto({
          priority:
            i % 4 === 0 ? 'Critical' : i % 4 === 1 ? 'High' : i % 4 === 2 ? 'Medium' : 'Low',
        });
        createPromises.push(
          RepairOrderTestSetup.makeRequest()
            .post('/repair-orders')
            .set('Authorization', RepairOrderTestSetup.getAdminAuth())
            .query({
              branch_id: RepairOrderTestSetup.testData.branchData.id,
              status_id: RepairOrderTestSetup.testData.repairStatus.id,
            })
            .send(createDto),
        );
      }

      await Promise.all(createPromises);

      // Test various pagination scenarios
      const paginationTests = [
        { limit: 10, offset: 0 },
        { limit: 20, offset: 10 },
        { limit: 15, offset: 30 },
        { limit: 25, offset: 20 },
      ];

      for (const params of paginationTests) {
        const startTime = Date.now();

        const response = await RepairOrderTestSetup.makeRequest()
          .get('/repair-orders')
          .set('Authorization', RepairOrderTestSetup.getAdminAuth())
          .query({
            branch_id: RepairOrderTestSetup.testData.branchData.id,
            limit: params.limit,
            offset: params.offset,
          })
          .expect(200);

        const endTime = Date.now();
        const executionTime = endTime - startTime;

        // Should complete quickly (under 2 seconds)
        expect(executionTime).toBeLessThan(2000);

        // Should return expected structure
        expect(response.body).toBeDefined();
        expect(typeof response.body).toBe('object');

        console.log(
          `Pagination (limit: ${params.limit}, offset: ${params.offset}) took ${executionTime}ms`,
        );
      }
    });

    it('should handle deep pagination efficiently', async () => {
      // Create 100 repair orders
      const totalRecords = 100;
      const batchSize = 20;

      for (let batch = 0; batch < totalRecords / batchSize; batch++) {
        const batchPromises = [];
        for (let i = 0; i < batchSize; i++) {
          const createDto = await RepairOrderTestSetup.createValidRepairOrderDto();
          batchPromises.push(
            RepairOrderTestSetup.makeRequest()
              .post('/repair-orders')
              .set('Authorization', RepairOrderTestSetup.getAdminAuth())
              .query({
                branch_id: RepairOrderTestSetup.testData.branchData.id,
                status_id: RepairOrderTestSetup.testData.repairStatus.id,
              })
              .send(createDto),
          );
        }
        await Promise.all(batchPromises);
      }

      // Test deep pagination
      const startTime = Date.now();

      const response = await RepairOrderTestSetup.makeRequest()
        .get('/repair-orders')
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({
          branch_id: RepairOrderTestSetup.testData.branchData.id,
          limit: 10,
          offset: 80, // Deep into the result set
        })
        .expect(200);

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Should complete reasonably quickly (under 3 seconds)
      expect(executionTime).toBeLessThan(3000);

      // Should return valid data
      expect(response.body).toBeDefined();

      console.log(`Deep pagination (offset: 80) took ${executionTime}ms`);
    });

    it('should handle filtering with pagination efficiently', async () => {
      // Create repair orders with different priorities
      const priorities = ['Low', 'Medium', 'High', 'Critical'];
      const recordsPerPriority = 10;

      for (const priority of priorities) {
        const promises = [];
        for (let i = 0; i < recordsPerPriority; i++) {
          const createDto = await RepairOrderTestSetup.createValidRepairOrderDto({ priority });
          promises.push(
            RepairOrderTestSetup.makeRequest()
              .post('/repair-orders')
              .set('Authorization', RepairOrderTestSetup.getAdminAuth())
              .query({
                branch_id: RepairOrderTestSetup.testData.branchData.id,
                status_id: RepairOrderTestSetup.testData.repairStatus.id,
              })
              .send(createDto),
          );
        }
        await Promise.all(promises);
      }

      // Test filtered pagination
      for (const priority of priorities) {
        const startTime = Date.now();

        const response = await RepairOrderTestSetup.makeRequest()
          .get('/repair-orders')
          .set('Authorization', RepairOrderTestSetup.getAdminAuth())
          .query({
            branch_id: RepairOrderTestSetup.testData.branchData.id,
            priority: priority,
            limit: 5,
            offset: 2,
          })
          .expect(200);

        const endTime = Date.now();
        const executionTime = endTime - startTime;

        expect(executionTime).toBeLessThan(2000);

        console.log(`Filtered pagination (priority: ${priority}) took ${executionTime}ms`);
      }
    });
  });

  describe('Search Performance', () => {
    it('should handle text search efficiently', async () => {
      // Create repair orders with searchable user data
      const searchTerms = ['John Doe', 'Jane Smith', 'Bob Johnson', 'Alice Brown'];

      for (const searchTerm of searchTerms) {
        const [firstName, lastName] = searchTerm.split(' ');
        const createDto = await RepairOrderTestSetup.createValidRepairOrderDto();

        // Note: This assumes we can create users with specific names
        // Adjust based on actual user creation capabilities
        await RepairOrderTestSetup.makeRequest()
          .post('/repair-orders')
          .set('Authorization', RepairOrderTestSetup.getAdminAuth())
          .query({
            branch_id: RepairOrderTestSetup.testData.branchData.id,
            status_id: RepairOrderTestSetup.testData.repairStatus.id,
          })
          .send(createDto);
      }

      // Test search performance
      for (const term of searchTerms) {
        const startTime = Date.now();

        const response = await RepairOrderTestSetup.makeRequest()
          .get('/repair-orders')
          .set('Authorization', RepairOrderTestSetup.getAdminAuth())
          .query({
            branch_id: RepairOrderTestSetup.testData.branchData.id,
            search: term.split(' ')[0], // Search by first name
          })
          .expect(200);

        const endTime = Date.now();
        const executionTime = endTime - startTime;

        expect(executionTime).toBeLessThan(1500);

        console.log(`Search for "${term}" took ${executionTime}ms`);
      }
    });

    it('should handle date range searches efficiently', async () => {
      // Create repair orders across different time periods
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Create repair orders (they'll have current timestamp)
      const promises = [];
      for (let i = 0; i < 20; i++) {
        const createDto = await RepairOrderTestSetup.createValidRepairOrderDto();
        promises.push(
          RepairOrderTestSetup.makeRequest()
            .post('/repair-orders')
            .set('Authorization', RepairOrderTestSetup.getAdminAuth())
            .query({
              branch_id: RepairOrderTestSetup.testData.branchData.id,
              status_id: RepairOrderTestSetup.testData.repairStatus.id,
            })
            .send(createDto),
        );
      }
      await Promise.all(promises);

      // Test date range searches
      const dateRangeTests = [
        { from: oneMonthAgo.toISOString(), to: now.toISOString() },
        { from: oneWeekAgo.toISOString(), to: now.toISOString() },
        { from: oneWeekAgo.toISOString() }, // Only from date
        { to: now.toISOString() }, // Only to date
      ];

      for (const dateRange of dateRangeTests) {
        const startTime = Date.now();

        const queryParams = {
          branch_id: RepairOrderTestSetup.testData.branchData.id,
          ...(dateRange.from && { created_from: dateRange.from }),
          ...(dateRange.to && { created_to: dateRange.to }),
        };

        await RepairOrderTestSetup.makeRequest()
          .get('/repair-orders')
          .set('Authorization', RepairOrderTestSetup.getAdminAuth())
          .query(queryParams)
          .expect(200);

        const endTime = Date.now();
        const executionTime = endTime - startTime;

        expect(executionTime).toBeLessThan(2000);

        console.log(`Date range search took ${executionTime}ms`);
      }
    });
  });

  describe('Concurrent Operations Performance', () => {
    it('should handle concurrent read operations efficiently', async () => {
      // Create some repair orders first
      const repairOrderIds = [];
      for (let i = 0; i < 5; i++) {
        const createDto = await RepairOrderTestSetup.createValidRepairOrderDto();
        const response = await RepairOrderTestSetup.makeRequest()
          .post('/repair-orders')
          .set('Authorization', RepairOrderTestSetup.getAdminAuth())
          .query({
            branch_id: RepairOrderTestSetup.testData.branchData.id,
            status_id: RepairOrderTestSetup.testData.repairStatus.id,
          })
          .send(createDto);
        repairOrderIds.push(response.body.id);
      }

      // Perform concurrent reads
      const startTime = Date.now();
      const concurrentReads = [];

      // Mix of different read operations
      for (let i = 0; i < 10; i++) {
        if (i % 2 === 0) {
          // Single repair order reads
          const id = repairOrderIds[i % repairOrderIds.length];
          concurrentReads.push(
            RepairOrderTestSetup.makeRequest()
              .get(`/repair-orders/${id}`)
              .set('Authorization', RepairOrderTestSetup.getAdminAuth()),
          );
        } else {
          // List requests
          concurrentReads.push(
            RepairOrderTestSetup.makeRequest()
              .get('/repair-orders')
              .set('Authorization', RepairOrderTestSetup.getAdminAuth())
              .query({
                branch_id: RepairOrderTestSetup.testData.branchData.id,
                limit: 10,
              }),
          );
        }
      }

      const responses = await Promise.all(concurrentReads);
      const endTime = Date.now();

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });

      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(5000);

      console.log(`${concurrentReads.length} concurrent read operations took ${executionTime}ms`);
    });

    it('should handle mixed concurrent operations efficiently', async () => {
      // Create initial repair orders
      const repairOrderIds = [];
      for (let i = 0; i < 3; i++) {
        const createDto = await RepairOrderTestSetup.createValidRepairOrderDto();
        const response = await RepairOrderTestSetup.makeRequest()
          .post('/repair-orders')
          .set('Authorization', RepairOrderTestSetup.getAdminAuth())
          .query({
            branch_id: RepairOrderTestSetup.testData.branchData.id,
            status_id: RepairOrderTestSetup.testData.repairStatus.id,
          })
          .send(createDto);
        repairOrderIds.push(response.body.id);
      }

      const startTime = Date.now();
      const mixedOperations = [];

      // Mix of create, read, and update operations
      for (let i = 0; i < 12; i++) {
        if (i % 3 === 0) {
          // Create operation
          const createDto = await RepairOrderTestSetup.createValidRepairOrderDto();
          mixedOperations.push(
            RepairOrderTestSetup.makeRequest()
              .post('/repair-orders')
              .set('Authorization', RepairOrderTestSetup.getAdminAuth())
              .query({
                branch_id: RepairOrderTestSetup.testData.branchData.id,
                status_id: RepairOrderTestSetup.testData.repairStatus.id,
              })
              .send(createDto),
          );
        } else if (i % 3 === 1) {
          // Read operation
          const id = repairOrderIds[i % repairOrderIds.length];
          mixedOperations.push(
            RepairOrderTestSetup.makeRequest()
              .get(`/repair-orders/${id}`)
              .set('Authorization', RepairOrderTestSetup.getAdminAuth()),
          );
        } else {
          // Update operation
          const id = repairOrderIds[i % repairOrderIds.length];
          mixedOperations.push(
            RepairOrderTestSetup.makeRequest()
              .patch(`/repair-orders/${id}`)
              .set('Authorization', RepairOrderTestSetup.getAdminAuth())
              .send({ priority: 'High' }),
          );
        }
      }

      const responses = await Promise.allSettled(mixedOperations);
      const endTime = Date.now();

      // Most should succeed
      const successfulResponses = responses.filter(
        (response) => response.status === 'fulfilled' && [200, 201].includes(response.value.status),
      );

      expect(successfulResponses.length).toBeGreaterThan(mixedOperations.length * 0.8); // At least 80% success

      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(10000);

      console.log(`${mixedOperations.length} mixed concurrent operations took ${executionTime}ms`);
    });
  });

  describe('Database Query Performance', () => {
    it('should maintain performance with large history tables', async () => {
      const repairOrderId = (await RepairOrderTestSetup.createTestRepairOrder()).id;

      // Generate many history records through multiple updates
      for (let i = 0; i < 20; i++) {
        await RepairOrderTestSetup.makeRequest()
          .patch(`/repair-orders/${repairOrderId}`)
          .set('Authorization', RepairOrderTestSetup.getAdminAuth())
          .send({
            priority: i % 2 === 0 ? 'High' : 'Low',
            total: (i + 1) * 10000,
          });

        await RepairOrderTestSetup.makeRequest()
          .patch(`/repair-orders/${repairOrderId}/move`)
          .set('Authorization', RepairOrderTestSetup.getAdminAuth())
          .query({
            status_id:
              i % 2 === 0
                ? RepairOrderTestSetup.testData.inProgressStatus.id
                : RepairOrderTestSetup.testData.repairStatus.id,
          })
          .send({ notes: `Update ${i}` });
      }

      // Now test read performance with large history
      const startTime = Date.now();

      const response = await RepairOrderTestSetup.makeRequest()
        .get(`/repair-orders/${repairOrderId}`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .expect(200);

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(3000);
      expect(response.body).toHaveProperty('id', repairOrderId);

      console.log(`Read with large history (40+ records) took ${executionTime}ms`);
    });

    it('should handle complex joins efficiently', async () => {
      // Create repair orders with full related data
      const promises = [];
      for (let i = 0; i < 10; i++) {
        const createDto = await RepairOrderTestSetup.createValidRepairOrderDto({
          initial_problems: Array(3)
            .fill(null)
            .map(() => ({
              problem_category_id: RepairOrderTestSetup.testData.problemCategory.id,
              price: 100000,
              estimated_minutes: 60,
              parts: [],
            })),
          comments: Array(2)
            .fill(null)
            .map((_, j) => ({
              text: `Comment ${j} for repair order ${i}`,
            })),
        });

        promises.push(
          RepairOrderTestSetup.makeRequest()
            .post('/repair-orders')
            .set('Authorization', RepairOrderTestSetup.getAdminAuth())
            .query({
              branch_id: RepairOrderTestSetup.testData.branchData.id,
              status_id: RepairOrderTestSetup.testData.repairStatus.id,
            })
            .send(createDto),
        );
      }

      await Promise.all(promises);

      // Test list query performance with complex joins
      const startTime = Date.now();

      const response = await RepairOrderTestSetup.makeRequest()
        .get('/repair-orders')
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({
          branch_id: RepairOrderTestSetup.testData.branchData.id,
          limit: 10,
        })
        .expect(200);

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(3000);
      expect(response.body).toBeDefined();

      console.log(`Complex joins query took ${executionTime}ms`);
    });
  });
});
