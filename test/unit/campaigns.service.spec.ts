import { Test, TestingModule } from '@nestjs/testing';
import { CampaignsService } from '../../src/campaigns/campaigns.service';
import { CampaignFactory } from '../factories/campaign.factory';
import { AdminFactory } from '../factories/admin.factory';

describe('CampaignsService', () => {
  let service: CampaignsService;
  let mockKnex: any;
  let mockRedis: any;
  let mockBullMQQueue: any;

  beforeEach(async () => {
    mockKnex = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      first: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      transaction: jest.fn(),
      raw: jest.fn(),
    };

    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
    };

    mockBullMQQueue = {
      add: jest.fn(),
      getJobs: jest.fn(),
      getJobCounts: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignsService,
        { provide: 'KnexConnection', useValue: mockKnex },
        { provide: 'RedisClient', useValue: mockRedis },
        { provide: 'BullMQQueue', useValue: mockBullMQQueue },
      ],
    }).compile();

    service = module.get<CampaignsService>(CampaignsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return campaigns with pagination', async () => {
      // Arrange
      const mockCampaigns = CampaignFactory.createMany(3);
      const mockCount = [{ count: '5' }];

      mockKnex.count.mockResolvedValueOnce(mockCount);
      mockKnex.first.mockResolvedValueOnce(mockCampaigns);

      // Act
      const result = await service.findAll({ limit: 3, offset: 0 });

      // Assert
      expect(result.data).toEqual(mockCampaigns);
      expect(result.meta.total).toBe(5);
    });

    it('should filter by status', async () => {
      // Arrange
      const mockCampaigns = [CampaignFactory.create({ status: 'Sent' })];
      const mockCount = [{ count: '1' }];

      mockKnex.count.mockResolvedValueOnce(mockCount);
      mockKnex.first.mockResolvedValueOnce(mockCampaigns);

      // Act
      const result = await service.findAll({ status: 'Sent' });

      // Assert
      expect(mockKnex.where).toHaveBeenCalledWith('campaigns.status', 'Sent');
    });

    it('should filter by type', async () => {
      // Arrange
      const mockCampaigns = [CampaignFactory.create({ type: 'SMS' })];
      const mockCount = [{ count: '1' }];

      mockKnex.count.mockResolvedValueOnce(mockCount);
      mockKnex.first.mockResolvedValueOnce(mockCampaigns);

      // Act
      const result = await service.findAll({ type: 'SMS' });

      // Assert
      expect(mockKnex.where).toHaveBeenCalledWith('campaigns.type', 'SMS');
    });
  });

  describe('create', () => {
    it('should create SMS campaign successfully', async () => {
      // Arrange
      const campaignDto = CampaignFactory.createDto({
        type: 'SMS',
        message: 'Test SMS message',
      });
      const adminId = 'admin-123';
      const mockInsertId = ['campaign-123'];

      mockKnex.insert.mockResolvedValueOnce(mockInsertId);
      mockKnex.transaction.mockImplementation((callback) => callback(mockKnex));

      // Act
      const result = await service.create(campaignDto, adminId);

      // Assert
      expect(result.message).toBe('Campaign created successfully');
      expect(result.campaign_id).toBe(mockInsertId[0]);
      expect(mockKnex.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SMS',
          message: 'Test SMS message',
          created_by: adminId,
          status: 'Pending',
        }),
      );
    });

    it('should create Email campaign with subject', async () => {
      // Arrange
      const campaignDto = CampaignFactory.createDto({
        type: 'Email',
        subject: 'Test Subject',
        message: 'Test email message',
      });
      const adminId = 'admin-123';
      const mockInsertId = ['campaign-123'];

      mockKnex.insert.mockResolvedValueOnce(mockInsertId);
      mockKnex.transaction.mockImplementation((callback) => callback(mockKnex));

      // Act
      const result = await service.create(campaignDto, adminId);

      // Assert
      expect(mockKnex.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'Email',
          subject: 'Test Subject',
          message: 'Test email message',
        }),
      );
    });

    it('should validate SMS message length', async () => {
      // Arrange
      const campaignDto = CampaignFactory.createDto({
        type: 'SMS',
        message: 'a'.repeat(161), // Too long for SMS
      });

      // Act & Assert
      await expect(service.create(campaignDto, 'admin-123')).rejects.toThrow(
        'SMS message too long',
      );
    });

    it('should require subject for email campaigns', async () => {
      // Arrange
      const campaignDto = {
        type: 'Email',
        message: 'Test message',
        // Missing subject
      };

      // Act & Assert
      await expect(service.create(campaignDto as any, 'admin-123')).rejects.toThrow(
        'Subject is required for email campaigns',
      );
    });
  });

  describe('findOne', () => {
    it('should return campaign by id', async () => {
      // Arrange
      const campaignId = 'campaign-123';
      const mockCampaign = CampaignFactory.create({ id: campaignId });

      mockKnex.first.mockResolvedValueOnce(mockCampaign);

      // Act
      const result = await service.findOne(campaignId);

      // Assert
      expect(result.data).toEqual(mockCampaign);
      expect(mockKnex.where).toHaveBeenCalledWith('campaigns.id', campaignId);
    });

    it('should throw error for non-existent campaign', async () => {
      // Arrange
      mockKnex.first.mockResolvedValueOnce(null);

      // Act & Assert
      await expect(service.findOne('non-existent-id')).rejects.toThrow('Campaign not found');
    });
  });

  describe('update', () => {
    it('should update pending campaign successfully', async () => {
      // Arrange
      const campaignId = 'campaign-123';
      const updateDto = { message: 'Updated message' };
      const adminId = 'admin-123';
      const mockCampaign = CampaignFactory.create({
        id: campaignId,
        status: 'Pending',
      });

      mockKnex.first.mockResolvedValueOnce(mockCampaign);
      mockKnex.update.mockResolvedValueOnce(1);

      // Act
      const result = await service.update(campaignId, updateDto, adminId);

      // Assert
      expect(result.message).toBe('Campaign updated successfully');
      expect(mockKnex.update).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Updated message',
          updated_by: adminId,
        }),
      );
    });

    it('should not update sent campaign', async () => {
      // Arrange
      const campaignId = 'campaign-123';
      const updateDto = { message: 'Updated message' };
      const mockCampaign = CampaignFactory.create({
        id: campaignId,
        status: 'Sent',
      });

      mockKnex.first.mockResolvedValueOnce(mockCampaign);

      // Act & Assert
      await expect(service.update(campaignId, updateDto, 'admin-123')).rejects.toThrow(
        'Cannot update sent campaign',
      );
    });

    it('should invalidate cache after update', async () => {
      // Arrange
      const campaignId = 'campaign-123';
      const updateDto = { message: 'Updated message' };
      const mockCampaign = CampaignFactory.create({
        id: campaignId,
        status: 'Pending',
      });

      mockKnex.first.mockResolvedValueOnce(mockCampaign);
      mockKnex.update.mockResolvedValueOnce(1);

      // Act
      await service.update(campaignId, updateDto, 'admin-123');

      // Assert
      expect(mockRedis.keys).toHaveBeenCalledWith('campaigns:*');
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should soft delete campaign', async () => {
      // Arrange
      const campaignId = 'campaign-123';
      const adminId = 'admin-123';
      const mockCampaign = CampaignFactory.create({ id: campaignId });

      mockKnex.first.mockResolvedValueOnce(mockCampaign);
      mockKnex.update.mockResolvedValueOnce(1);

      // Act
      const result = await service.remove(campaignId, adminId);

      // Assert
      expect(result.message).toBe('Campaign deleted successfully');
      expect(mockKnex.update).toHaveBeenCalledWith({
        deleted_at: expect.any(Date),
        updated_by: adminId,
      });
    });
  });

  describe('sendCampaign', () => {
    it('should queue SMS campaign for sending', async () => {
      // Arrange
      const campaignId = 'campaign-123';
      const adminId = 'admin-123';
      const mockCampaign = CampaignFactory.create({
        id: campaignId,
        type: 'SMS',
        status: 'Pending',
      });

      mockKnex.first.mockResolvedValueOnce(mockCampaign);
      mockKnex.update.mockResolvedValueOnce(1);
      mockKnex.transaction.mockImplementation((callback) => callback(mockKnex));

      // Act
      const result = await service.sendCampaign(campaignId, adminId);

      // Assert
      expect(result.message).toBe('Campaign queued for sending');
      expect(mockKnex.update).toHaveBeenCalledWith({
        status: 'Processing',
        sent_at: expect.any(Date),
        updated_by: adminId,
      });
      expect(mockBullMQQueue.add).toHaveBeenCalledWith(
        'send-sms-campaign',
        { campaignId },
        { delay: 0 },
      );
    });

    it('should queue Email campaign for sending', async () => {
      // Arrange
      const campaignId = 'campaign-123';
      const adminId = 'admin-123';
      const mockCampaign = CampaignFactory.create({
        id: campaignId,
        type: 'Email',
        status: 'Pending',
      });

      mockKnex.first.mockResolvedValueOnce(mockCampaign);
      mockKnex.update.mockResolvedValueOnce(1);
      mockKnex.transaction.mockImplementation((callback) => callback(mockKnex));

      // Act
      await service.sendCampaign(campaignId, adminId);

      // Assert
      expect(mockBullMQQueue.add).toHaveBeenCalledWith(
        'send-email-campaign',
        { campaignId },
        { delay: 0 },
      );
    });

    it('should not send already sent campaign', async () => {
      // Arrange
      const campaignId = 'campaign-123';
      const mockCampaign = CampaignFactory.create({
        id: campaignId,
        status: 'Sent',
      });

      mockKnex.first.mockResolvedValueOnce(mockCampaign);

      // Act & Assert
      await expect(service.sendCampaign(campaignId, 'admin-123')).rejects.toThrow(
        'Campaign already sent',
      );
    });
  });

  describe('getCampaignStats', () => {
    it('should return campaign statistics', async () => {
      // Arrange
      const mockStats = [
        { status: 'Sent', count: '10' },
        { status: 'Pending', count: '5' },
        { status: 'Failed', count: '2' },
      ];

      mockKnex.raw.mockResolvedValueOnce({ rows: mockStats });

      // Act
      const result = await service.getCampaignStats();

      // Assert
      expect(result.data.total_campaigns).toBe(17);
      expect(result.data.sent_campaigns).toBe(10);
      expect(result.data.pending_campaigns).toBe(5);
      expect(result.data.failed_campaigns).toBe(2);
    });

    it('should cache statistics', async () => {
      // Arrange
      const mockStats = [{ status: 'Sent', count: '10' }];
      mockKnex.raw.mockResolvedValueOnce({ rows: mockStats });
      mockRedis.get.mockResolvedValueOnce(null);

      // Act
      await service.getCampaignStats();

      // Assert
      expect(mockRedis.set).toHaveBeenCalledWith('campaigns:stats', expect.any(String), 'EX', 1800);
    });
  });

  describe('previewCampaign', () => {
    it('should generate campaign preview', async () => {
      // Arrange
      const previewDto = {
        type: 'SMS',
        message: 'Hello {{user_name}}, your repair is ready!',
        target_audience: 'all_users',
      };

      const mockUsers = [
        { id: '1', name: 'John Doe' },
        { id: '2', name: 'Jane Smith' },
      ];

      mockKnex.count.mockResolvedValueOnce([{ count: '100' }]);
      mockKnex.limit.mockResolvedValueOnce(mockUsers);

      // Act
      const result = await service.previewCampaign(previewDto);

      // Assert
      expect(result.data.preview_count).toBe(100);
      expect(result.data.sample_recipients).toHaveLength(2);
      expect(result.data.sample_recipients[0].preview_message).toBe(
        'Hello John Doe, your repair is ready!',
      );
    });
  });

  describe('scheduleCampaign', () => {
    it('should schedule campaign for later sending', async () => {
      // Arrange
      const campaignId = 'campaign-123';
      const scheduledAt = new Date(Date.now() + 3600000); // 1 hour from now
      const adminId = 'admin-123';
      const mockCampaign = CampaignFactory.create({
        id: campaignId,
        status: 'Pending',
      });

      mockKnex.first.mockResolvedValueOnce(mockCampaign);
      mockKnex.update.mockResolvedValueOnce(1);

      // Act
      const result = await service.scheduleCampaign(campaignId, scheduledAt, adminId);

      // Assert
      expect(result.message).toBe('Campaign scheduled successfully');
      expect(mockKnex.update).toHaveBeenCalledWith({
        scheduled_at: scheduledAt,
        status: 'Scheduled',
        updated_by: adminId,
      });
      expect(mockBullMQQueue.add).toHaveBeenCalledWith(
        'send-scheduled-campaign',
        { campaignId },
        { delay: expect.any(Number) },
      );
    });

    it('should not schedule in the past', async () => {
      // Arrange
      const campaignId = 'campaign-123';
      const pastDate = new Date(Date.now() - 3600000); // 1 hour ago

      // Act & Assert
      await expect(service.scheduleCampaign(campaignId, pastDate, 'admin-123')).rejects.toThrow(
        'Cannot schedule campaign in the past',
      );
    });
  });

  describe('cancelCampaign', () => {
    it('should cancel scheduled campaign', async () => {
      // Arrange
      const campaignId = 'campaign-123';
      const adminId = 'admin-123';
      const mockCampaign = CampaignFactory.create({
        id: campaignId,
        status: 'Scheduled',
      });

      mockKnex.first.mockResolvedValueOnce(mockCampaign);
      mockKnex.update.mockResolvedValueOnce(1);

      // Act
      const result = await service.cancelCampaign(campaignId, adminId);

      // Assert
      expect(result.message).toBe('Campaign cancelled successfully');
      expect(mockKnex.update).toHaveBeenCalledWith({
        status: 'Cancelled',
        updated_by: adminId,
      });
    });

    it('should not cancel sent campaign', async () => {
      // Arrange
      const campaignId = 'campaign-123';
      const mockCampaign = CampaignFactory.create({
        id: campaignId,
        status: 'Sent',
      });

      mockKnex.first.mockResolvedValueOnce(mockCampaign);

      // Act & Assert
      await expect(service.cancelCampaign(campaignId, 'admin-123')).rejects.toThrow(
        'Cannot cancel sent campaign',
      );
    });
  });
});
