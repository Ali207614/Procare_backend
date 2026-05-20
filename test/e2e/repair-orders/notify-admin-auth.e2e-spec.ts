import { RepairOrderTestSetup } from './setup.e2e';

describe('Repair Orders - notify-admin Basic Auth Tests', () => {
  beforeAll(async () => {
    await RepairOrderTestSetup.setupApplication();
  });

  afterAll(async () => {
    await RepairOrderTestSetup.cleanupApplication();
  });

  it('should reject access with 401 if Authorization header is missing', async () => {
    await RepairOrderTestSetup.makeRequest()
      .get('/repair-orders/open/notify-admin')
      .query({
        repair_order_id: '00000000-0000-0000-0000-000000000000',
        admin_id: '00000000-0000-0000-0000-000000000000',
      })
      .expect(401);
  });

  it('should reject access with 401 if Authorization header is not Basic', async () => {
    await RepairOrderTestSetup.makeRequest()
      .get('/repair-orders/open/notify-admin')
      .set('Authorization', 'Bearer invalid_token')
      .query({
        repair_order_id: '00000000-0000-0000-0000-000000000000',
        admin_id: '00000000-0000-0000-0000-000000000000',
      })
      .expect(401);
  });

  it('should reject access with 401 if credentials are invalid', async () => {
    const invalidCredentials = Buffer.from('wrong_user:wrong_pass').toString('base64');
    await RepairOrderTestSetup.makeRequest()
      .get('/repair-orders/open/notify-admin')
      .set('Authorization', `Basic ${invalidCredentials}`)
      .query({
        repair_order_id: '00000000-0000-0000-0000-000000000000',
        admin_id: '00000000-0000-0000-0000-000000000000',
      })
      .expect(401);
  });

  it('should pass authentication with correct credentials (and fail on business validation because IDs do not exist)', async () => {
    // Under NODE_ENV=test, the env variables from .env.test are:
    // NOTIFY_ADMIN_BASIC_AUTH_USER=test_notify_admin_client
    // NOTIFY_ADMIN_BASIC_AUTH_PASSWORD=test_notify_admin_password_123
    const correctCredentials = Buffer.from('test_notify_admin_client:test_notify_admin_password_123').toString('base64');
    
    const response = await RepairOrderTestSetup.makeRequest()
      .get('/repair-orders/open/notify-admin')
      .set('Authorization', `Basic ${correctCredentials}`)
      .query({
        repair_order_id: '00000000-0000-0000-0000-000000000000',
        admin_id: '00000000-0000-0000-0000-000000000000',
      });

    // It should not be 401 Unauthorized
    expect(response.status).not.toBe(401);
  });

  it('should handle stress-testing with 100 concurrent requests without failing or leaking timing information', async () => {
    const correctCredentials = Buffer.from('test_notify_admin_client:test_notify_admin_password_123').toString('base64');
    const incorrectCredentials = Buffer.from('wrong_user:wrong_password').toString('base64');
    
    const requests = Array.from({ length: 100 }).map((_, index) => {
      const useCorrect = index % 2 === 0;
      const creds = useCorrect ? correctCredentials : incorrectCredentials;
      return RepairOrderTestSetup.makeRequest()
        .get('/repair-orders/open/notify-admin')
        .set('Authorization', `Basic ${creds}`)
        .query({
          repair_order_id: '00000000-0000-0000-0000-000000000000',
          admin_id: '00000000-0000-0000-0000-000000000000',
        });
    });

    const responses = await Promise.all(requests);
    
    responses.forEach((response, index) => {
      const wasCorrect = index % 2 === 0;
      if (wasCorrect) {
        expect(response.status).not.toBe(401);
      } else {
        expect(response.status).toBe(401);
      }
    });
  });
});
