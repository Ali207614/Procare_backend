import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { CampaignsService } from '../src/campaigns/campaigns.service';
import { AppModule } from '../src/app.module';
import { AdminFactory } from './factories/admin.factory';
import { CampaignFactory } from './factories/campaign.factory';
import { TestHelpers } from './utils/test-helpers';

describe('CampaignsService (Integration)', () => {
  let app: INestApplication;
  let service: CampaignsService;
  let knex: any;
  let redis: any;
  let adminData: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    service = moduleFixture.get<CampaignsService>(CampaignsService);
    knex = moduleFixture.get('KnexConnection');
    redis = moduleFixture.get('RedisClient');

    // Create test admin
    adminData = await AdminFactory.create(knex);
  });

  beforeEach(async () => {
    await TestHelpers.cleanCampaignsTable(knex);
  });

  afterAll(async () => {
    await TestHelpers.cleanDatabase(knex);
    await app.close();
  });

  describe('findAll', () => {
    it('should retrieve campaigns with pagination', async () => {
      // Arrange
      const campaigns = await CampaignFactory.createMany(knex, 5, { created_by: adminData.id });

      // Act
      const result = await service.findAll({ limit: 3, offset: 0 });

      // Assert
      expect(result.data).toHaveLength(3);
      expect(result.meta.total).toBe(5);
      expect(result.meta.limit).toBe(3);
      expect(result.meta.offset).toBe(0);
    });

    it('should filter campaigns by status', async () => {
      // Arrange
      await CampaignFactory.create(knex, { status: 'Sent', created_by: adminData.id });
      await CampaignFactory.create(knex, { status: 'Pending', created_by: adminData.id });
      await CampaignFactory.create(knex, { status: 'Failed', created_by: adminData.id });

      // Act
      const result = await service.findAll({ status: 'Sent' });

      // Assert
      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe('Sent');
    });

    it('should filter campaigns by type', async () => {
      // Arrange
      await CampaignFactory.create(knex, { type: 'SMS', created_by: adminData.id });
      await CampaignFactory.create(knex, { type: 'Email', created_by: adminData.id });

      // Act
      const result = await service.findAll({ type: 'SMS' });

      // Assert
      expect(result.data).toHaveLength(1);
      expect(result.data[0].type).toBe('SMS');
    });
  });

  describe('create', () => {
    it('should create SMS campaign successfully', async () => {
      // Arrange
      const campaignDto = CampaignFactory.createDto({
        type: 'SMS',
        message: 'Test SMS message',
        target_audience: 'all_users',
      });

      // Act
      const result = await service.create(campaignDto, adminData.id);

      // Assert
      expect(result.message).toBe('Campaign created successfully');

      const campaign = await knex('campaigns').where({ id: result.campaign_id }).first();
      expect(campaign).toBeDefined();
      expect(campaign.type).toBe('SMS');
      expect(campaign.message).toBe('Test SMS message');
      expect(campaign.created_by).toBe(adminData.id);
      expect(campaign.status).toBe('Pending');
    });

    it('should create Email campaign successfully', async () => {
      // Arrange
      const campaignDto = CampaignFactory.createDto({
        type: 'Email',
        subject: 'Test Email Subject',
        message: 'Test email content',
        target_audience: 'active_users',
      });

      // Act
      const result = await service.create(campaignDto, adminData.id);

      // Assert
      expect(result.message).toBe('Campaign created successfully');

      const campaign = await knex('campaigns').where({ id: result.campaign_id }).first();
      expect(campaign.type).toBe('Email');
      expect(campaign.subject).toBe('Test Email Subject');
      expect(campaign.message).toBe('Test email content');
    });

    it('should create Telegram campaign successfully', async () => {
      // Arrange
      const campaignDto = CampaignFactory.createDto({
        type: 'Telegram',
        message: 'Test Telegram message',
        target_audience: 'telegram_users',
      });

      // Act
      const result = await service.create(campaignDto, adminData.id);

      // Assert
      expect(result.message).toBe('Campaign created successfully');

      const campaign = await knex('campaigns').where({ id: result.campaign_id }).first();
      expect(campaign.type).toBe('Telegram');
      expect(campaign.message).toBe('Test Telegram message');
    });
  });

  describe('findOne', () => {
    it('should retrieve campaign by id', async () => {
      // Arrange
      const campaign = await CampaignFactory.create(knex, { created_by: adminData.id });

      // Act
      const result = await service.findOne(campaign.id);

      // Assert
      expect(result.data.id).toBe(campaign.id);
      expect(result.data.type).toBe(campaign.type);
      expect(result.data.message).toBe(campaign.message);
    });

    it('should throw error for non-existent campaign', async () => {
      // Arrange
      const fakeId = 'non-existent-id';

      // Act & Assert
      await expect(service.findOne(fakeId)).rejects.toThrow('Campaign not found');
    });
  });

  describe('update', () => {
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

      // Act
      const result = await service.update(campaign.id, updateDto, adminData.id);

      // Assert
      expect(result.message).toBe('Campaign updated successfully');

      const updatedCampaign = await knex('campaigns').where({ id: campaign.id }).first();
      expect(updatedCampaign.message).toBe('Updated message content');
      expect(updatedCampaign.target_audience).toBe('premium_users');
      expect(updatedCampaign.updated_by).toBe(adminData.id);
    });

    it('should not allow updating sent campaign', async () => {
      // Arrange
      const campaign = await CampaignFactory.create(knex, {
        status: 'Sent',
        created_by: adminData.id,
      });

      // Act & Assert
      await expect(
        service.update(campaign.id, { message: 'New message' }, adminData.id),
      ).rejects.toThrow('Cannot update sent campaign');
    });
  });

  describe('remove', () => {
    it('should soft delete campaign', async () => {
      // Arrange
      const campaign = await CampaignFactory.create(knex, { created_by: adminData.id });

      // Act
      const result = await service.remove(campaign.id, adminData.id);

      // Assert
      expect(result.message).toBe('Campaign deleted successfully');

      const deletedCampaign = await knex('campaigns').where({ id: campaign.id }).first();
      expect(deletedCampaign.deleted_at).toBeDefined();
      expect(deletedCampaign.updated_by).toBe(adminData.id);
    });

    it('should not delete non-existent campaign', async () => {
      // Act & Assert
      await expect(service.remove('non-existent-id', adminData.id)).rejects.toThrow(
        'Campaign not found',
      );
    });
  });

  describe('sendCampaign', () => {
    it('should queue SMS campaign for sending', async () => {
      // Arrange
      const campaign = await CampaignFactory.create(knex, {
        type: 'SMS',
        status: 'Pending',
        created_by: adminData.id,
      });

      // Act
      const result = await service.sendCampaign(campaign.id, adminData.id);

      // Assert
      expect(result.message).toBe('Campaign queued for sending');

      const updatedCampaign = await knex('campaigns').where({ id: campaign.id }).first();
      expect(updatedCampaign.status).toBe('Processing');
      expect(updatedCampaign.sent_at).toBeDefined();
    });

    it('should not send already sent campaign', async () => {
      // Arrange
      const campaign = await CampaignFactory.create(knex, {
        status: 'Sent',
        created_by: adminData.id,
      });

      // Act & Assert
      await expect(service.sendCampaign(campaign.id, adminData.id)).rejects.toThrow(
        'Campaign already sent',
      );
    });
  });

  describe('getCampaignStats', () => {
    it('should return campaign statistics', async () => {
      // Arrange
      await CampaignFactory.create(knex, { status: 'Sent', created_by: adminData.id });
      await CampaignFactory.create(knex, { status: 'Pending', created_by: adminData.id });
      await CampaignFactory.create(knex, { status: 'Failed', created_by: adminData.id });

      // Act
      const result = await service.getCampaignStats();

      // Assert
      expect(result.data.total_campaigns).toBe(3);
      expect(result.data.sent_campaigns).toBe(1);
      expect(result.data.pending_campaigns).toBe(1);
      expect(result.data.failed_campaigns).toBe(1);
    });
  });
});
