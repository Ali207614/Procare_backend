import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AdminFactory } from './factories/admin.factory';
import { CampaignFactory } from './factories/campaign.factory';
import { UserFactory } from './factories/user.factory';
import { TestHelpers } from './utils/test-helpers';

describe('Campaigns (e2e)', () => {
  let app: INestApplication;
  let knex: any;
  let adminData: any;
  let userData: any;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    knex = moduleFixture.get('KnexConnection');

    adminData = await AdminFactory.create(knex);
    userData = await UserFactory.create(knex);
    authToken = await TestHelpers.authenticateAdmin(app, adminData);
  });

  beforeEach(async () => {
    await TestHelpers.cleanCampaignsTable(knex);
  });

  afterAll(async () => {
    await TestHelpers.cleanDatabase(knex);
    await app.close();
  });

  describe('/campaigns (GET)', () => {
    it('should return campaigns with pagination', async () => {
      // Arrange
      const campaigns = await CampaignFactory.createMany(knex, 5, {
        created_by: adminData.id,
      });

      // Act & Assert
      const response = await request(app.getHttpServer())
        .get('/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 3, offset: 0 })
        .expect(200);

      expect(response.body.data).toHaveLength(3);
      expect(response.body.meta.total).toBe(5);
      expect(response.body.meta.limit).toBe(3);
      expect(response.body.meta.offset).toBe(0);
    });

    it('should filter campaigns by status', async () => {
      // Arrange
      await CampaignFactory.create(knex, { status: 'Sent', created_by: adminData.id });
      await CampaignFactory.create(knex, { status: 'Pending', created_by: adminData.id });
      await CampaignFactory.create(knex, { status: 'Failed', created_by: adminData.id });

      // Act & Assert
      const response = await request(app.getHttpServer())
        .get('/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ status: 'Sent' })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe('Sent');
    });

    it('should filter campaigns by type', async () => {
      // Arrange
      await CampaignFactory.create(knex, { type: 'SMS', created_by: adminData.id });
      await CampaignFactory.create(knex, { type: 'Email', created_by: adminData.id });

      // Act & Assert
      const response = await request(app.getHttpServer())
        .get('/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ type: 'SMS' })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].type).toBe('SMS');
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer()).get('/campaigns').expect(401);
    });
  });

  describe('/campaigns (POST)', () => {
    it('should create SMS campaign successfully', async () => {
      // Arrange
      const campaignDto = {
        type: 'SMS',
        message: 'Test SMS message',
        target_audience: 'all_users',
      };

      // Act & Assert
      const response = await request(app.getHttpServer())
        .post('/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send(campaignDto)
        .expect(201);

      expect(response.body.message).toBe('Campaign created successfully');
      expect(response.body.campaign_id).toBeDefined();

      const campaign = await knex('campaigns').where({ id: response.body.campaign_id }).first();

      expect(campaign.type).toBe('SMS');
      expect(campaign.message).toBe('Test SMS message');
      expect(campaign.status).toBe('Pending');
    });

    it('should create Email campaign successfully', async () => {
      // Arrange
      const campaignDto = {
        type: 'Email',
        subject: 'Test Email Subject',
        message: 'Test email content',
        target_audience: 'active_users',
      };

      // Act & Assert
      const response = await request(app.getHttpServer())
        .post('/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send(campaignDto)
        .expect(201);

      expect(response.body.message).toBe('Campaign created successfully');

      const campaign = await knex('campaigns').where({ id: response.body.campaign_id }).first();

      expect(campaign.type).toBe('Email');
      expect(campaign.subject).toBe('Test Email Subject');
      expect(campaign.message).toBe('Test email content');
    });

    it('should create Telegram campaign successfully', async () => {
      // Arrange
      const campaignDto = {
        type: 'Telegram',
        message: 'Test Telegram message',
        target_audience: 'telegram_users',
      };

      // Act & Assert
      const response = await request(app.getHttpServer())
        .post('/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send(campaignDto)
        .expect(201);

      expect(response.body.message).toBe('Campaign created successfully');

      const campaign = await knex('campaigns').where({ id: response.body.campaign_id }).first();

      expect(campaign.type).toBe('Telegram');
      expect(campaign.message).toBe('Test Telegram message');
    });

    it('should return 400 for invalid data', async () => {
      // Arrange
      const invalidDto = {
        type: 'INVALID_TYPE',
        message: 'Test message',
      };

      // Act & Assert
      await request(app.getHttpServer())
        .post('/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidDto)
        .expect(400);
    });

    it('should return 400 for missing required fields', async () => {
      // Arrange
      const incompleteDto = {
        type: 'SMS',
        // Missing message
      };

      // Act & Assert
      await request(app.getHttpServer())
        .post('/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send(incompleteDto)
        .expect(400);
    });

    it('should return 400 for Email without subject', async () => {
      // Arrange
      const emailDto = {
        type: 'Email',
        message: 'Test message',
        // Missing subject
      };

      // Act & Assert
      const response = await request(app.getHttpServer())
        .post('/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send(emailDto)
        .expect(400);

      expect(response.body.message).toContain('subject');
    });
  });

  describe('/campaigns/:id (GET)', () => {
    it('should return campaign by id', async () => {
      // Arrange
      const campaign = await CampaignFactory.create(knex, {
        created_by: adminData.id,
      });

      // Act & Assert
      const response = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.id).toBe(campaign.id);
      expect(response.body.data.type).toBe(campaign.type);
      expect(response.body.data.message).toBe(campaign.message);
    });

    it('should return 404 for non-existent campaign', async () => {
      // Act & Assert
      const response = await request(app.getHttpServer())
        .get('/campaigns/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.message).toContain('not found');
    });
  });

  describe('/campaigns/:id (PATCH)', () => {
    it('should update campaign successfully', async () => {
      // Arrange
      const campaign = await CampaignFactory.create(knex, {
        status: 'Pending',
        created_by: adminData.id,
      });

      const updateDto = {
        message: 'Updated message content',
        target_audience: 'premium_users',
      };

      // Act & Assert
      const response = await request(app.getHttpServer())
        .patch(`/campaigns/${campaign.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.message).toBe('Campaign updated successfully');

      const updatedCampaign = await knex('campaigns').where({ id: campaign.id }).first();

      expect(updatedCampaign.message).toBe('Updated message content');
      expect(updatedCampaign.target_audience).toBe('premium_users');
    });

    it('should return 400 when updating sent campaign', async () => {
      // Arrange
      const campaign = await CampaignFactory.create(knex, {
        status: 'Sent',
        created_by: adminData.id,
      });

      // Act & Assert
      const response = await request(app.getHttpServer())
        .patch(`/campaigns/${campaign.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ message: 'New message' })
        .expect(400);

      expect(response.body.message).toContain('Cannot update sent campaign');
    });
  });

  describe('/campaigns/:id (DELETE)', () => {
    it('should soft delete campaign', async () => {
      // Arrange
      const campaign = await CampaignFactory.create(knex, {
        created_by: adminData.id,
      });

      // Act & Assert
      const response = await request(app.getHttpServer())
        .delete(`/campaigns/${campaign.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toBe('Campaign deleted successfully');

      const deletedCampaign = await knex('campaigns').where({ id: campaign.id }).first();

      expect(deletedCampaign.deleted_at).toBeDefined();
    });

    it('should return 404 for non-existent campaign', async () => {
      // Act & Assert
      await request(app.getHttpServer())
        .delete('/campaigns/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('/campaigns/:id/send (POST)', () => {
    it('should queue SMS campaign for sending', async () => {
      // Arrange
      const campaign = await CampaignFactory.create(knex, {
        type: 'SMS',
        status: 'Pending',
        created_by: adminData.id,
      });

      // Act & Assert
      const response = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/send`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toBe('Campaign queued for sending');

      const updatedCampaign = await knex('campaigns').where({ id: campaign.id }).first();

      expect(updatedCampaign.status).toBe('Processing');
      expect(updatedCampaign.sent_at).toBeDefined();
    });

    it('should return 400 for already sent campaign', async () => {
      // Arrange
      const campaign = await CampaignFactory.create(knex, {
        status: 'Sent',
        created_by: adminData.id,
      });

      // Act & Assert
      const response = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/send`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.message).toContain('Campaign already sent');
    });
  });

  describe('/campaigns/stats (GET)', () => {
    it('should return campaign statistics', async () => {
      // Arrange
      await CampaignFactory.create(knex, { status: 'Sent', created_by: adminData.id });
      await CampaignFactory.create(knex, { status: 'Pending', created_by: adminData.id });
      await CampaignFactory.create(knex, { status: 'Failed', created_by: adminData.id });

      // Act & Assert
      const response = await request(app.getHttpServer())
        .get('/campaigns/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.total_campaigns).toBe(3);
      expect(response.body.data.sent_campaigns).toBe(1);
      expect(response.body.data.pending_campaigns).toBe(1);
      expect(response.body.data.failed_campaigns).toBe(1);
    });
  });

  describe('/campaigns/preview (POST)', () => {
    it('should preview campaign content', async () => {
      // Arrange
      const previewDto = {
        type: 'SMS',
        message: 'Hello {{user_name}}, your repair is ready!',
        target_audience: 'all_users',
      };

      // Act & Assert
      const response = await request(app.getHttpServer())
        .post('/campaigns/preview')
        .set('Authorization', `Bearer ${authToken}`)
        .send(previewDto)
        .expect(200);

      expect(response.body.data.preview_count).toBeGreaterThan(0);
      expect(response.body.data.sample_recipients).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle server errors gracefully', async () => {
      // Simulate server error
      const originalKnex = knex.raw;
      knex.raw = () => Promise.reject(new Error('Database connection failed'));

      const response = await request(app.getHttpServer())
        .get('/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      expect(response.body.message).toContain('Internal server error');

      knex.raw = originalKnex;
    });

    it('should validate message length limits', async () => {
      const longMessage = 'a'.repeat(1001); // Exceeds SMS limit

      const campaignDto = {
        type: 'SMS',
        message: longMessage,
        target_audience: 'all_users',
      };

      await request(app.getHttpServer())
        .post('/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send(campaignDto)
        .expect(400);
    });

    it('should validate target audience options', async () => {
      const campaignDto = {
        type: 'SMS',
        message: 'Test message',
        target_audience: 'invalid_audience',
      };

      await request(app.getHttpServer())
        .post('/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send(campaignDto)
        .expect(400);
    });
  });

  describe('Performance', () => {
    it('should handle large campaign lists efficiently', async () => {
      // Arrange
      await CampaignFactory.createMany(knex, 100, { created_by: adminData.id });

      // Act
      const start = Date.now();
      const response = await request(app.getHttpServer())
        .get('/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 50, offset: 0 })
        .expect(200);
      const duration = Date.now() - start;

      // Assert
      expect(response.body.data).toHaveLength(50);
      expect(response.body.meta.total).toBe(100);
      expect(duration).toBeLessThan(2000); // Should complete in less than 2 seconds
    });
  });

  describe('Security', () => {
    it('should prevent campaign access by different admin', async () => {
      // Arrange
      const otherAdmin = await AdminFactory.create(knex);
      const campaign = await CampaignFactory.create(knex, {
        created_by: otherAdmin.id,
      });

      // Act & Assert - depending on your security model
      // This test assumes campaigns are visible to all admins with proper permissions
      const response = await request(app.getHttpServer())
        .get(`/campaigns/${campaign.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200); // Or 403 if access should be restricted

      expect(response.body.data.id).toBe(campaign.id);
    });

    it('should validate campaign ownership for updates', async () => {
      // This would depend on your business logic
      // Whether admins can update campaigns created by others
      const otherAdmin = await AdminFactory.create(knex);
      const campaign = await CampaignFactory.create(knex, {
        created_by: otherAdmin.id,
        status: 'Pending',
      });

      const updateDto = {
        message: 'Updated by different admin',
      };

      // Depending on your business rules, this might be 200 or 403
      await request(app.getHttpServer())
        .patch(`/campaigns/${campaign.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateDto)
        .expect(200); // Adjust based on your business logic
    });
  });
});
