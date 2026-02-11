import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { CampaignsService } from '../src/campaigns/campaigns.service';
import { AuthService } from '../src/auth/auth.service';
import { TestModuleBuilder } from './utils/test-module-builder';
import { CoverageHelpers } from './utils/coverage-helpers';

describe('Campaigns Controller Complete E2E', () => {
  let app: INestApplication;
  let authService: AuthService;
  let campaignsService: CampaignsService;
  let knex: any;
  let redis: any;
  let adminToken: string;
  let limitedAdminToken: string;
  let testAdmin: any;
  let limitedAdmin: any;
  let testBranch: any;
  let testCampaign: any;
  let secondTestCampaign: any;
  let testUsers: any[];

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
    campaignsService = module.get<CampaignsService>(CampaignsService);
    knex = module.get('KNEX_CONNECTION');
    redis = module.get('REDIS_CLIENT');

    // Clean database and cache
    await knex.raw('DELETE FROM campaign_recipients');
    await knex.raw('DELETE FROM campaigns');
    await knex.raw('DELETE FROM users');
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
    await knex.raw('DELETE FROM campaign_recipients');
    await knex.raw('DELETE FROM campaigns');
    await knex.raw('DELETE FROM users');
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
    // Create test branch
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

    // Create campaign permissions
    const campaignPermissions = [
      'campaign.create',
      'campaign.view',
      'campaign.update',
      'campaign.delete',
      'pause:campaign',
      'resume:campaign',
    ];

    for (const permission of campaignPermissions) {
      await knex('permissions').insert({
        id: knex.raw('gen_random_uuid()'),
        name: permission,
        description: `Permission for ${permission}`,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    // Create test role with all campaign permissions
    const testRole = await knex('roles')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        name: 'Campaign Manager Role',
        description: 'Role for managing campaigns',
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    const role = testRole[0];

    // Create limited role with only view permission
    const limitedRole = await knex('roles')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        name: 'Limited Role',
        description: 'Role with limited permissions',
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    const limitedRoleRecord = limitedRole[0];

    // Assign permissions to roles
    const allPermissions = await knex('permissions').select('*');
    for (const permission of allPermissions) {
      await knex('role_permissions').insert({
        id: knex.raw('gen_random_uuid()'),
        role_id: role.id,
        permission_id: permission.id,
        created_at: new Date(),
        updated_at: new Date(),
      });

      // Only assign view permission to limited role
      if (permission.name === 'campaign.view') {
        await knex('role_permissions').insert({
          id: knex.raw('gen_random_uuid()'),
          role_id: limitedRoleRecord.id,
          permission_id: permission.id,
          created_at: new Date(),
          updated_at: new Date(),
        });
      }
    }

    // Create test admins
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

    limitedAdmin = await knex('admins')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        first_name: 'Limited',
        last_name: 'Admin',
        phone: '+998902222222',
        login: 'limitedadmin',
        password: '$2b$10$K7L/VxwjnydKw.fK8tUqme7kk7IgJ9J9J9J9J9J9J9J9J9J9J9J9',
        branch_id: testBranch.id,
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    limitedAdmin = limitedAdmin[0];

    // Assign roles to admins
    await knex('admin_roles').insert({
      id: knex.raw('gen_random_uuid()'),
      admin_id: testAdmin.id,
      role_id: role.id,
      created_at: new Date(),
      updated_at: new Date(),
    });

    await knex('admin_roles').insert({
      id: knex.raw('gen_random_uuid()'),
      admin_id: limitedAdmin.id,
      role_id: limitedRoleRecord.id,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Create test users
    testUsers = [];
    for (let i = 1; i <= 5; i++) {
      const user = await knex('users')
        .insert({
          id: knex.raw('gen_random_uuid()'),
          first_name: `User${i}`,
          last_name: `Test${i}`,
          phone: `+99890${3000 + i}`,
          email: `user${i}@test.com`,
          status: 'Active',
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('*');
      testUsers.push(user[0]);
    }

    // Create test campaigns
    testCampaign = await knex('campaigns')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        name: 'Test Campaign',
        type: 'SMS',
        message: 'This is a test SMS campaign',
        status: 'Draft',
        scheduled_date: new Date(Date.now() + 86400000), // Tomorrow
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    testCampaign = testCampaign[0];

    secondTestCampaign = await knex('campaigns')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        name: 'Second Test Campaign',
        type: 'Email',
        message: 'This is a test Email campaign',
        subject: 'Test Email Subject',
        status: 'Active',
        scheduled_date: new Date(Date.now() + 172800000), // Day after tomorrow
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    secondTestCampaign = secondTestCampaign[0];

    // Create campaign recipients
    for (let i = 0; i < 3; i++) {
      await knex('campaign_recipients').insert({
        id: knex.raw('gen_random_uuid()'),
        campaign_id: testCampaign.id,
        user_id: testUsers[i].id,
        status: 'Pending',
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    // Generate tokens
    adminToken = authService.generateJwtToken({
      id: testAdmin.id,
      login: testAdmin.login,
      first_name: testAdmin.first_name,
      last_name: testAdmin.last_name,
      phone: testAdmin.phone,
      branch_id: testAdmin.branch_id,
      status: testAdmin.status,
    });

    limitedAdminToken = authService.generateJwtToken({
      id: limitedAdmin.id,
      login: limitedAdmin.login,
      first_name: limitedAdmin.first_name,
      last_name: limitedAdmin.last_name,
      phone: limitedAdmin.phone,
      branch_id: limitedAdmin.branch_id,
      status: limitedAdmin.status,
    });
  }

  describe('POST /api/v1/campaigns (Create Campaign)', () => {
    it('should create SMS campaign successfully with proper permissions', async () => {
      const newCampaignData = {
        name: 'New SMS Campaign',
        type: 'SMS',
        message: 'This is a new SMS campaign message',
        scheduled_date: new Date(Date.now() + 86400000).toISOString(),
        user_ids: [testUsers[0].id, testUsers[1].id],
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/campaigns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newCampaignData)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        name: newCampaignData.name,
        type: newCampaignData.type,
        message: newCampaignData.message,
        status: 'Draft',
        scheduled_date: expect.any(String),
      });

      // Verify campaign was created in database
      const createdCampaign = await knex('campaigns').where('id', response.body.id).first();
      expect(createdCampaign).toBeTruthy();
      expect(createdCampaign.name).toBe(newCampaignData.name);

      // Verify recipients were created
      const recipients = await knex('campaign_recipients').where('campaign_id', response.body.id);
      expect(recipients.length).toBe(2);
    });

    it('should create Email campaign with subject', async () => {
      const emailCampaignData = {
        name: 'New Email Campaign',
        type: 'Email',
        message: 'This is a new email campaign message',
        subject: 'Test Email Subject',
        scheduled_date: new Date(Date.now() + 86400000).toISOString(),
        user_ids: [testUsers[2].id],
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/campaigns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(emailCampaignData)
        .expect(201);

      expect(response.body.type).toBe('Email');
      expect(response.body.subject).toBe(emailCampaignData.subject);
    });

    it('should create Telegram campaign', async () => {
      const telegramCampaignData = {
        name: 'New Telegram Campaign',
        type: 'Telegram',
        message: 'This is a new telegram campaign message',
        scheduled_date: new Date(Date.now() + 86400000).toISOString(),
        user_ids: [testUsers[3].id],
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/campaigns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(telegramCampaignData)
        .expect(201);

      expect(response.body.type).toBe('Telegram');
    });

    it('should fail with invalid campaign type', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/campaigns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Campaign',
          type: 'InvalidType',
          message: 'Invalid campaign',
          scheduled_date: new Date(Date.now() + 86400000).toISOString(),
          user_ids: [testUsers[0].id],
        })
        .expect(400);
    });

    it('should fail with past scheduled date', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/campaigns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Past Date Campaign',
          type: 'SMS',
          message: 'Campaign with past date',
          scheduled_date: new Date(Date.now() - 86400000).toISOString(), // Yesterday
          user_ids: [testUsers[0].id],
        })
        .expect(400);
    });

    it('should fail with empty user_ids array', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/campaigns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'No Recipients Campaign',
          type: 'SMS',
          message: 'Campaign without recipients',
          scheduled_date: new Date(Date.now() + 86400000).toISOString(),
          user_ids: [],
        })
        .expect(400);
    });

    it('should fail with non-existent user IDs', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/campaigns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Recipients Campaign',
          type: 'SMS',
          message: 'Campaign with invalid recipients',
          scheduled_date: new Date(Date.now() + 86400000).toISOString(),
          user_ids: ['00000000-0000-4000-8000-000000000000'],
        })
        .expect(404);
    });

    it('should fail without proper permissions', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/campaigns')
        .set('Authorization', `Bearer ${limitedAdminToken}`)
        .send({
          name: 'Unauthorized Campaign',
          type: 'SMS',
          message: 'Unauthorized campaign',
          scheduled_date: new Date(Date.now() + 86400000).toISOString(),
          user_ids: [testUsers[0].id],
        })
        .expect(403);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/campaigns')
        .send({
          name: 'No Auth Campaign',
          type: 'SMS',
          message: 'Campaign without authentication',
          scheduled_date: new Date(Date.now() + 86400000).toISOString(),
          user_ids: [testUsers[0].id],
        })
        .expect(401);
    });
  });

  describe('GET /api/v1/campaigns (Get All Campaigns)', () => {
    beforeEach(async () => {
      // Create additional campaigns for pagination testing
      for (let i = 1; i <= 5; i++) {
        await knex('campaigns').insert({
          id: knex.raw('gen_random_uuid()'),
          name: `Campaign ${i}`,
          type: i % 2 === 0 ? 'Email' : 'SMS',
          message: `Campaign message ${i}`,
          subject: i % 2 === 0 ? `Subject ${i}` : null,
          status: i % 3 === 0 ? 'Completed' : i % 2 === 0 ? 'Active' : 'Draft',
          scheduled_date: new Date(Date.now() + i * 86400000),
          created_at: new Date(Date.now() - i * 3600000),
          updated_at: new Date(),
        });
      }
    });

    it('should return all campaigns with default pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/campaigns')
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

      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.meta.total).toBeGreaterThanOrEqual(response.body.data.length);

      // Verify campaign structure
      const campaign = response.body.data[0];
      expect(campaign).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        type: expect.any(String),
        message: expect.any(String),
        status: expect.any(String),
        scheduled_date: expect.any(String),
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });
    });

    it('should filter campaigns by type', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/campaigns?type=SMS')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      response.body.data.forEach((campaign) => {
        expect(campaign.type).toBe('SMS');
      });
    });

    it('should filter campaigns by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/campaigns?status=Draft')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      response.body.data.forEach((campaign) => {
        expect(campaign.status).toBe('Draft');
      });
    });

    it('should search campaigns by name', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/campaigns?search=Test Campaign')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].name).toContain('Test Campaign');
    });

    it('should paginate results correctly', async () => {
      const limit = 3;
      const offset = 2;

      const response = await request(app.getHttpServer())
        .get(`/api/v1/campaigns?limit=${limit}&offset=${offset}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.meta.limit).toBe(limit);
      expect(response.body.meta.offset).toBe(offset);
      expect(response.body.data.length).toBeLessThanOrEqual(limit);
    });

    it('should sort campaigns by creation date', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/campaigns?sort_by=created_at&sort_order=desc')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const dates = response.body.data.map((campaign) => new Date(campaign.created_at));
      const sortedDates = [...dates].sort((a, b) => b.getTime() - a.getTime());
      expect(dates).toEqual(sortedDates);
    });

    it('should handle combined filters and pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/campaigns?type=SMS&status=Draft&limit=2')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(2);
      response.body.data.forEach((campaign) => {
        expect(campaign.type).toBe('SMS');
        expect(campaign.status).toBe('Draft');
      });
    });

    it('should return empty results for non-matching filters', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/campaigns?search=NonExistentCampaign')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(0);
      expect(response.body.meta.total).toBe(0);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer()).get('/api/v1/campaigns').expect(401);
    });
  });

  describe('GET /api/v1/campaigns/:id/recipients (Get Campaign Recipients)', () => {
    it('should return campaign recipients with user details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/campaigns/${testCampaign.id}/recipients`)
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

      expect(response.body.data.length).toBe(3); // 3 recipients for test campaign

      // Verify recipient structure
      const recipient = response.body.data[0];
      expect(recipient).toMatchObject({
        id: expect.any(String),
        campaign_id: testCampaign.id,
        user_id: expect.any(String),
        status: expect.any(String),
        user: expect.objectContaining({
          id: expect.any(String),
          first_name: expect.any(String),
          last_name: expect.any(String),
          phone: expect.any(String),
        }),
      });
    });

    it('should filter recipients by status', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/campaigns/${testCampaign.id}/recipients?status=Pending`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      response.body.data.forEach((recipient) => {
        expect(recipient.status).toBe('Pending');
      });
    });

    it('should search recipients by user name', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/campaigns/${testCampaign.id}/recipients?search=User1`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].user.first_name).toBe('User1');
    });

    it('should paginate recipients correctly', async () => {
      const limit = 2;
      const offset = 1;

      const response = await request(app.getHttpServer())
        .get(`/api/v1/campaigns/${testCampaign.id}/recipients?limit=${limit}&offset=${offset}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.meta.limit).toBe(limit);
      expect(response.body.meta.offset).toBe(offset);
      expect(response.body.data.length).toBeLessThanOrEqual(limit);
    });

    it('should return empty results for campaign with no recipients', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/campaigns/${secondTestCampaign.id}/recipients`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(0);
      expect(response.body.meta.total).toBe(0);
    });

    it('should fail with non-existent campaign ID', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/campaigns/00000000-0000-4000-8000-000000000000/recipients')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/campaigns/${testCampaign.id}/recipients`)
        .expect(401);
    });
  });

  describe('GET /api/v1/campaigns/:campaign_id (Get Campaign by ID)', () => {
    it('should return campaign details successfully', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/campaigns/${testCampaign.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: testCampaign.id,
        name: testCampaign.name,
        type: testCampaign.type,
        message: testCampaign.message,
        status: testCampaign.status,
        scheduled_date: expect.any(String),
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });
    });

    it('should return email campaign with subject', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/campaigns/${secondTestCampaign.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.type).toBe('Email');
      expect(response.body.subject).toBe(secondTestCampaign.subject);
    });

    it('should fail with non-existent campaign ID', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/campaigns/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should fail with invalid UUID format', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/campaigns/invalid-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer()).get(`/api/v1/campaigns/${testCampaign.id}`).expect(401);
    });
  });

  describe('PATCH /api/v1/campaigns/:campaign_id (Update Campaign)', () => {
    it('should update campaign successfully', async () => {
      const updateData = {
        name: 'Updated Campaign Name',
        message: 'Updated campaign message',
        scheduled_date: new Date(Date.now() + 172800000).toISOString(),
      };

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/campaigns/${testCampaign.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        id: testCampaign.id,
        name: updateData.name,
        message: updateData.message,
        scheduled_date: expect.any(String),
      });

      // Verify campaign was updated in database
      const updatedCampaign = await knex('campaigns').where('id', testCampaign.id).first();
      expect(updatedCampaign.name).toBe(updateData.name);
      expect(updatedCampaign.message).toBe(updateData.message);
    });

    it('should update partial campaign data', async () => {
      const updateData = {
        name: 'Partially Updated Campaign',
      };

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/campaigns/${secondTestCampaign.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe(updateData.name);
      expect(response.body.type).toBe(secondTestCampaign.type); // Should remain unchanged
    });

    it('should fail when updating non-existent campaign', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/campaigns/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Non-existent Campaign',
        })
        .expect(404);
    });

    it('should fail with past scheduled date', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/campaigns/${testCampaign.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          scheduled_date: new Date(Date.now() - 86400000).toISOString(), // Yesterday
        })
        .expect(400);
    });

    it('should fail without proper permissions', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/campaigns/${testCampaign.id}`)
        .set('Authorization', `Bearer ${limitedAdminToken}`)
        .send({
          name: 'Unauthorized Update',
        })
        .expect(403);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/campaigns/${testCampaign.id}`)
        .send({
          name: 'No Auth Update',
        })
        .expect(401);
    });
  });

  describe('DELETE /api/v1/campaigns/:campaign_id (Delete Campaign)', () => {
    it('should delete campaign successfully', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/campaigns/${secondTestCampaign.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Verify campaign was deleted from database
      const deletedCampaign = await knex('campaigns').where('id', secondTestCampaign.id).first();
      expect(deletedCampaign).toBeFalsy();

      // Verify associated recipients were also deleted
      const recipients = await knex('campaign_recipients').where(
        'campaign_id',
        secondTestCampaign.id,
      );
      expect(recipients.length).toBe(0);
    });

    it('should fail when deleting non-existent campaign', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/campaigns/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should fail without proper permissions', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/campaigns/${testCampaign.id}`)
        .set('Authorization', `Bearer ${limitedAdminToken}`)
        .expect(403);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer()).delete(`/api/v1/campaigns/${testCampaign.id}`).expect(401);
    });
  });

  describe('PATCH /api/v1/campaigns/:campaign_id/pause (Pause Campaign)', () => {
    it('should pause campaign successfully', async () => {
      // First set campaign to Active status
      await knex('campaigns').where('id', testCampaign.id).update({ status: 'Active' });

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/campaigns/${testCampaign.id}/pause`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toEqual({
        message: `Campaign ${testCampaign.id} paused`,
      });

      // Verify campaign status was updated to Paused
      const pausedCampaign = await knex('campaigns').where('id', testCampaign.id).first();
      expect(pausedCampaign.status).toBe('Paused');
    });

    it('should fail when pausing non-existent campaign', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/campaigns/00000000-0000-4000-8000-000000000000/pause')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should fail without proper permissions', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/campaigns/${testCampaign.id}/pause`)
        .set('Authorization', `Bearer ${limitedAdminToken}`)
        .expect(403);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/campaigns/${testCampaign.id}/pause`)
        .expect(401);
    });
  });

  describe('PATCH /api/v1/campaigns/:campaign_id/resume (Resume Campaign)', () => {
    beforeEach(async () => {
      // Set campaign to Paused status for resume tests
      await knex('campaigns').where('id', testCampaign.id).update({ status: 'Paused' });
    });

    it('should resume campaign successfully', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/campaigns/${testCampaign.id}/resume`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toEqual({
        message: `Campaign ${testCampaign.id} resumed`,
      });

      // Verify campaign status was updated to Active
      const resumedCampaign = await knex('campaigns').where('id', testCampaign.id).first();
      expect(resumedCampaign.status).toBe('Active');
    });

    it('should fail when resuming non-existent campaign', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/campaigns/00000000-0000-4000-8000-000000000000/resume')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should fail without proper permissions', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/campaigns/${testCampaign.id}/resume`)
        .set('Authorization', `Bearer ${limitedAdminToken}`)
        .expect(403);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/campaigns/${testCampaign.id}/resume`)
        .expect(401);
    });
  });

  describe('Database Consistency Verification', () => {
    it('should maintain referential integrity for campaigns and recipients', async () => {
      const campaigns = await knex('campaigns').select('*');
      const recipients = await knex('campaign_recipients').select('*');
      const users = await knex('users').select('*');

      for (const recipient of recipients) {
        const campaign = campaigns.find((c) => c.id === recipient.campaign_id);
        const user = users.find((u) => u.id === recipient.user_id);
        expect(campaign).toBeTruthy();
        expect(user).toBeTruthy();
      }
    });

    it('should maintain audit fields correctly', async () => {
      const campaigns = await knex('campaigns').select('*');

      for (const campaign of campaigns) {
        expect(campaign.created_at).toBeTruthy();
        expect(campaign.updated_at).toBeTruthy();
        expect(new Date(campaign.created_at)).toBeInstanceOf(Date);
        expect(new Date(campaign.updated_at)).toBeInstanceOf(Date);
      }
    });

    it('should cascade delete recipients when campaign is deleted', async () => {
      // Create a campaign with recipients for deletion test
      const testDeleteCampaign = await knex('campaigns')
        .insert({
          id: knex.raw('gen_random_uuid()'),
          name: 'Delete Test Campaign',
          type: 'SMS',
          message: 'Campaign for deletion test',
          status: 'Draft',
          scheduled_date: new Date(Date.now() + 86400000),
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('*');

      await knex('campaign_recipients').insert({
        id: knex.raw('gen_random_uuid()'),
        campaign_id: testDeleteCampaign[0].id,
        user_id: testUsers[0].id,
        status: 'Pending',
        created_at: new Date(),
        updated_at: new Date(),
      });

      // Delete campaign
      await campaignsService.remove(testDeleteCampaign[0].id);

      // Verify recipients were also deleted
      const remainingRecipients = await knex('campaign_recipients').where(
        'campaign_id',
        testDeleteCampaign[0].id,
      );
      expect(remainingRecipients.length).toBe(0);
    });
  });

  describe('Security and Authorization', () => {
    it('should prevent unauthorized access to protected endpoints', async () => {
      const protectedEndpoints = [
        { method: 'post', path: '/api/v1/campaigns' },
        { method: 'patch', path: `/api/v1/campaigns/${testCampaign.id}` },
        { method: 'delete', path: `/api/v1/campaigns/${testCampaign.id}` },
        { method: 'patch', path: `/api/v1/campaigns/${testCampaign.id}/pause` },
        { method: 'patch', path: `/api/v1/campaigns/${testCampaign.id}/resume` },
      ];

      for (const endpoint of protectedEndpoints) {
        await request(app.getHttpServer())[endpoint.method](endpoint.path).expect(401);
      }
    });

    it('should validate admin permissions for each operation', async () => {
      const protectedEndpoints = [
        { method: 'post', path: '/api/v1/campaigns', data: {} },
        { method: 'patch', path: `/api/v1/campaigns/${testCampaign.id}`, data: {} },
        { method: 'delete', path: `/api/v1/campaigns/${testCampaign.id}` },
        { method: 'patch', path: `/api/v1/campaigns/${testCampaign.id}/pause` },
        { method: 'patch', path: `/api/v1/campaigns/${testCampaign.id}/resume` },
      ];

      for (const endpoint of protectedEndpoints) {
        const req = request(app.getHttpServer())
          [endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${limitedAdminToken}`);

        if (endpoint.data) {
          req.send(endpoint.data);
        }

        await req.expect(403);
      }
    });

    it('should validate JWT token format', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/campaigns')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .expect(401);
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle concurrent campaign creation requests', async () => {
      const promises = [];
      const campaignCount = 5;

      for (let i = 0; i < campaignCount; i++) {
        const promise = request(app.getHttpServer())
          .post('/api/v1/campaigns')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: `Concurrent Campaign ${i}`,
            type: 'SMS',
            message: `Concurrent campaign message ${i}`,
            scheduled_date: new Date(Date.now() + (i + 1) * 86400000).toISOString(),
            user_ids: [testUsers[0].id],
          });
        promises.push(promise);
      }

      const results = await Promise.allSettled(promises);
      const successful = results.filter((r) => r.status === 'fulfilled' && r.value.status === 201);

      expect(successful.length).toBe(campaignCount);
    });

    it('should handle large paginated requests efficiently', async () => {
      const startTime = Date.now();

      await request(app.getHttpServer())
        .get('/api/v1/campaigns?limit=50')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle campaigns with many recipients efficiently', async () => {
      // Create campaign with many recipients
      const manyCampaign = await knex('campaigns')
        .insert({
          id: knex.raw('gen_random_uuid()'),
          name: 'Many Recipients Campaign',
          type: 'SMS',
          message: 'Campaign with many recipients',
          status: 'Draft',
          scheduled_date: new Date(Date.now() + 86400000),
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('*');

      const recipients = [];
      for (let i = 0; i < testUsers.length; i++) {
        recipients.push({
          id: knex.raw('gen_random_uuid()'),
          campaign_id: manyCampaign[0].id,
          user_id: testUsers[i].id,
          status: 'Pending',
          created_at: new Date(),
          updated_at: new Date(),
        });
      }

      await knex('campaign_recipients').insert(recipients);

      const startTime = Date.now();

      await request(app.getHttpServer())
        .get(`/api/v1/campaigns/${manyCampaign[0].id}/recipients`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(3000); // Should complete within 3 seconds
    });
  });

  afterEach(async () => {
    // Generate coverage report after each test suite
    await CoverageHelpers.generateCoverageReport();
  });
});
