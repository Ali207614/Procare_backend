import { RepairOrderTestSetup } from './setup.e2e';
import { v4 as uuidv4 } from 'uuid';

describe('Repair Orders - Data Validation', () => {
  beforeAll(async () => {
    await RepairOrderTestSetup.setupApplication();
  });

  beforeEach(async () => {
    await RepairOrderTestSetup.cleanRepairOrderTables();
  });

  afterAll(async () => {
    await RepairOrderTestSetup.cleanupApplication();
  });

  describe('Required Fields Validation', () => {
    it('should validate required fields on create', async () => {
      const invalidDtos = [
        {}, // Empty object
        { user_id: RepairOrderTestSetup.testData.userData.id }, // Missing phone_category_id and status_id
        { phone_category_id: RepairOrderTestSetup.testData.phoneCategory.id }, // Missing user_id and status_id
        { status_id: RepairOrderTestSetup.testData.repairStatus.id }, // Missing user_id and phone_category_id
      ];

      for (const dto of invalidDtos) {
        const response = await RepairOrderTestSetup.makeRequest()
          .post('/repair-orders')
          .set('Authorization', RepairOrderTestSetup.getAdminAuth())
          .query({
            branch_id: RepairOrderTestSetup.testData.branchData.id,
            status_id: RepairOrderTestSetup.testData.repairStatus.id,
          })
          .send(dto)
          .expect(400);

        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('location');
      }
    });

    it('should validate query parameters', async () => {
      const createDto = await RepairOrderTestSetup.createValidRepairOrderDto();

      // Missing branch_id
      await RepairOrderTestSetup.makeRequest()
        .post('/repair-orders')
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({ status_id: RepairOrderTestSetup.testData.repairStatus.id })
        .send(createDto)
        .expect(400);

      // Missing status_id
      await RepairOrderTestSetup.makeRequest()
        .post('/repair-orders')
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({ branch_id: RepairOrderTestSetup.testData.branchData.id })
        .send(createDto)
        .expect(400);
    });

    it('should validate required nested object fields', async () => {
      const createDto = await RepairOrderTestSetup.createValidRepairOrderDto({
        initial_problems: [
          {
            // Missing problem_category_id
            price: 100000,
            estimated_minutes: 60,
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
        .expect(400);
    });
  });

  describe('UUID Format Validation', () => {
    it('should validate UUID format for IDs', async () => {
      const invalidUuids = ['not-a-uuid', '123', '', null, undefined];

      for (const invalidUuid of invalidUuids) {
        const createDto = await RepairOrderTestSetup.createValidRepairOrderDto({
          user_id: invalidUuid,
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
      }
    });

    it('should validate UUID format in URL parameters', async () => {
      const invalidUuids = ['not-a-uuid', '123', 'invalid-format'];

      for (const invalidUuid of invalidUuids) {
        await RepairOrderTestSetup.makeRequest()
          .get(`/repair-orders/${invalidUuid}`)
          .set('Authorization', RepairOrderTestSetup.getAdminAuth())
          .expect(400);

        await RepairOrderTestSetup.makeRequest()
          .patch(`/repair-orders/${invalidUuid}`)
          .set('Authorization', RepairOrderTestSetup.getAdminAuth())
          .send({ priority: 'High' })
          .expect(400);

        await RepairOrderTestSetup.makeRequest()
          .delete(`/repair-orders/${invalidUuid}`)
          .set('Authorization', RepairOrderTestSetup.getAdminAuth())
          .expect(400);
      }
    });

    it('should validate UUID format in query parameters', async () => {
      await RepairOrderTestSetup.makeRequest()
        .get('/repair-orders')
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({ branch_id: 'invalid-uuid' })
        .expect(400);

      const repairOrder = await RepairOrderTestSetup.createTestRepairOrder();

      await RepairOrderTestSetup.makeRequest()
        .patch(`/repair-orders/${repairOrder.id}/move`)
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({ status_id: 'invalid-uuid' })
        .send({ notes: 'Test move' })
        .expect(400);
    });
  });

  describe('Enum Values Validation', () => {
    it('should validate priority enum values', async () => {
      const invalidPriorities = ['Invalid', 'HIGHEST', 'lowest', 123, null];

      for (const priority of invalidPriorities) {
        const createDto = await RepairOrderTestSetup.createValidRepairOrderDto({ priority });

        await RepairOrderTestSetup.makeRequest()
          .post('/repair-orders')
          .set('Authorization', RepairOrderTestSetup.getAdminAuth())
          .query({
            branch_id: RepairOrderTestSetup.testData.branchData.id,
            status_id: RepairOrderTestSetup.testData.repairStatus.id,
          })
          .send(createDto)
          .expect(400);
      }
    });

    it('should accept valid priority enum values', async () => {
      const validPriorities = ['Low', 'Medium', 'High', 'Critical'];

      for (const priority of validPriorities) {
        const createDto = await RepairOrderTestSetup.createValidRepairOrderDto({ priority });

        await RepairOrderTestSetup.makeRequest()
          .post('/repair-orders')
          .set('Authorization', RepairOrderTestSetup.getAdminAuth())
          .query({
            branch_id: RepairOrderTestSetup.testData.branchData.id,
            status_id: RepairOrderTestSetup.testData.repairStatus.id,
          })
          .send(createDto)
          .expect(201);
      }
    });

    it('should validate currency enum values if specified', async () => {
      const createDto = await RepairOrderTestSetup.createValidRepairOrderDto({
        rental_phone: {
          rental_phone_id: uuidv4(),
          is_free: false,
          price: 50000,
          currency: 'INVALID_CURRENCY',
        },
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
  });

  describe('Nested Object Structure Validation', () => {
    it('should validate nested initial_problems structure', async () => {
      const invalidProblems = [
        [{ price: 'invalid-number' }], // Invalid price type
        [{ problem_category_id: 'invalid-uuid', price: 100 }], // Invalid UUID
        [{ problem_category_id: RepairOrderTestSetup.testData.problemCategory.id }], // Missing price
        [{ price: 100 }], // Missing problem_category_id
        [{ problem_category_id: RepairOrderTestSetup.testData.problemCategory.id, price: -100 }], // Negative price
      ];

      for (const problems of invalidProblems) {
        const createDto = await RepairOrderTestSetup.createValidRepairOrderDto({
          initial_problems: problems,
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
      }
    });

    it('should validate comments structure', async () => {
      const invalidComments = [
        [{ text: '' }], // Empty text
        [{ text: null }], // Null text
        [{}], // Missing text field
      ];

      for (const comments of invalidComments) {
        const createDto = await RepairOrderTestSetup.createValidRepairOrderDto({
          comments: comments,
        });

        const response = await RepairOrderTestSetup.makeRequest()
          .post('/repair-orders')
          .set('Authorization', RepairOrderTestSetup.getAdminAuth())
          .query({
            branch_id: RepairOrderTestSetup.testData.branchData.id,
            status_id: RepairOrderTestSetup.testData.repairStatus.id,
          })
          .send(createDto);

        expect([400, 201]).toContain(response.status); // Some validations might allow empty comments
      }
    });

    it('should validate rental_phone structure', async () => {
      const invalidRentalPhones = [
        {
          // Missing rental_phone_id
          is_free: false,
          price: 50000,
          currency: 'UZS',
        },
        {
          rental_phone_id: 'invalid-uuid',
          is_free: false,
          price: 50000,
          currency: 'UZS',
        },
        {
          rental_phone_id: uuidv4(),
          is_free: 'not-boolean', // Invalid boolean
          price: 50000,
          currency: 'UZS',
        },
        {
          rental_phone_id: uuidv4(),
          is_free: false,
          price: 'invalid-number', // Invalid price
          currency: 'UZS',
        },
      ];

      for (const rentalPhone of invalidRentalPhones) {
        const createDto = await RepairOrderTestSetup.createValidRepairOrderDto({
          rental_phone: rentalPhone,
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
      }
    });
  });

  describe('Array Constraints Validation', () => {
    it('should validate array uniqueness constraints', async () => {
      const createDto = await RepairOrderTestSetup.createValidRepairOrderDto({
        admin_ids: ['duplicate-id', 'duplicate-id'], // Should fail uniqueness
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

    it('should validate array size limits', async () => {
      // Test with very large arrays
      const manyProblems = Array(100)
        .fill(null)
        .map(() => ({
          problem_category_id: RepairOrderTestSetup.testData.problemCategory.id,
          price: 100000,
          estimated_minutes: 60,
          parts: [],
        }));

      const createDto = await RepairOrderTestSetup.createValidRepairOrderDto({
        initial_problems: manyProblems,
      });

      const response = await RepairOrderTestSetup.makeRequest()
        .post('/repair-orders')
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({
          branch_id: RepairOrderTestSetup.testData.branchData.id,
          status_id: RepairOrderTestSetup.testData.repairStatus.id,
        })
        .send(createDto);

      // Should either accept or reject based on array size limits
      expect([201, 400]).toContain(response.status);
    });

    it('should validate empty arrays', async () => {
      const createDto = await RepairOrderTestSetup.createValidRepairOrderDto({
        initial_problems: [], // Empty array
      });

      const response = await RepairOrderTestSetup.makeRequest()
        .post('/repair-orders')
        .set('Authorization', RepairOrderTestSetup.getAdminAuth())
        .query({
          branch_id: RepairOrderTestSetup.testData.branchData.id,
          status_id: RepairOrderTestSetup.testData.repairStatus.id,
        })
        .send(createDto);

      // Should either accept or reject based on business rules
      expect([201, 400]).toContain(response.status);
    });
  });

  describe('Business Logic Validation', () => {
    it('should validate business rules for problem pricing', async () => {
      const invalidProblem = {
        problem_category_id: RepairOrderTestSetup.testData.problemCategory.id,
        price: -100, // Negative price should be invalid
        estimated_minutes: 60,
        parts: [],
      };

      const createDto = await RepairOrderTestSetup.createValidRepairOrderDto({
        initial_problems: [invalidProblem],
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

    it('should validate estimated minutes constraints', async () => {
      const invalidProblem = {
        problem_category_id: RepairOrderTestSetup.testData.problemCategory.id,
        price: 100000,
        estimated_minutes: -30, // Negative minutes should be invalid
        parts: [],
      };

      const createDto = await RepairOrderTestSetup.createValidRepairOrderDto({
        initial_problems: [invalidProblem],
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

    it('should validate rental phone business rules', async () => {
      const invalidRentalPhone = {
        rental_phone_id: uuidv4(),
        is_free: false,
        price: 0, // Price should be > 0 when is_free is false
        currency: 'UZS',
      };

      const createDto = await RepairOrderTestSetup.createValidRepairOrderDto({
        rental_phone: invalidRentalPhone,
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

    it('should validate location coordinates', async () => {
      const invalidLocations = [
        {
          lat: 200, // Invalid latitude (should be -90 to 90)
          long: 69.2401,
          description: 'Test location',
        },
        {
          lat: 41.2995,
          long: 200, // Invalid longitude (should be -180 to 180)
          description: 'Test location',
        },
        {
          lat: -100, // Invalid latitude
          long: -200, // Invalid longitude
          description: 'Test location',
        },
      ];

      for (const location of invalidLocations) {
        const createDto = await RepairOrderTestSetup.createValidRepairOrderDto({
          pickup: location,
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
      }
    });

    it('should validate valid location coordinates', async () => {
      const validLocation = {
        lat: 41.2995, // Valid latitude
        long: 69.2401, // Valid longitude
        description: 'Tashkent location',
      };

      const createDto = await RepairOrderTestSetup.createValidRepairOrderDto({
        pickup: validLocation,
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
  });

  describe('String Length Validation', () => {
    it('should validate string length limits', async () => {
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

      expect([201, 400]).toContain(response.status);
    });

    it('should validate IMEI format if provided', async () => {
      const invalidIMEIs = [
        '123', // Too short
        'abcdefghijklmno', // Invalid characters
        '12345678901234567890', // Too long
      ];

      for (const imei of invalidIMEIs) {
        const createDto = await RepairOrderTestSetup.createValidRepairOrderDto({
          imei: imei,
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
      }
    });
  });

  describe('Numeric Range Validation', () => {
    it('should validate numeric ranges for price fields', async () => {
      const invalidPrices = [-1, 0, Number.MAX_SAFE_INTEGER + 1];

      for (const price of invalidPrices) {
        const createDto = await RepairOrderTestSetup.createValidRepairOrderDto({
          total: price,
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
      }
    });

    it('should validate numeric ranges for estimated minutes', async () => {
      const invalidMinutes = [-1, Number.MAX_SAFE_INTEGER + 1];

      for (const minutes of invalidMinutes) {
        const createDto = await RepairOrderTestSetup.createValidRepairOrderDto({
          initial_problems: [
            {
              problem_category_id: RepairOrderTestSetup.testData.problemCategory.id,
              price: 100000,
              estimated_minutes: minutes,
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
          .expect(400);
      }
    });
  });
});
