import { Test, TestingModule } from '@nestjs/testing';
import { CampaignsController } from '../../src/campaigns.controller';
import { CampaignsService } from '../../src/campaigns/campaigns.service';
import { AdminPayload } from '../../src/common/types/admin-payload.interface';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('CampaignsController', () => {
  let controller: CampaignsController;
  let service: CampaignsService;

  const mockCampaignsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    send: jest.fn(),
  };

  const mockAdminPayload: AdminPayload = {
    id: '660e8400-e29b-41d4-a716-446655440001',
    phone: '+998901234568',
    full_name: 'Test Admin',
    roles: ['admin-role-id'],
  };

  const mockCampaign = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test Campaign',
    description: 'Test Campaign Description',
    message_template: 'Hello {name}!',
    type: 'sms',
    status: 'Draft',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CampaignsController],
      providers: [
        {
          provide: CampaignsService,
          useValue: mockCampaignsService,
        },
      ],
    }).compile();

    controller = module.get<CampaignsController>(CampaignsController);
    service = module.get<CampaignsService>(CampaignsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new campaign successfully', async () => {
      // Arrange
      const createDto = {
        name: 'New Campaign',
        description: 'New Campaign Description',
        message_template: 'Hello {name}!',
        type: 'sms' as const,
      };

      mockCampaignsService.create.mockResolvedValue(mockCampaign);

      // Act
      const result = await controller.create(createDto, mockAdminPayload);

      // Assert
      expect(result).toEqual(mockCampaign);
      expect(service.create).toHaveBeenCalledWith(createDto, mockAdminPayload.id);
    });

    it('should handle validation errors', async () => {
      // Arrange
      const createDto = {
        name: '',
        description: '',
        message_template: '',
        type: 'sms' as const,
      };
      const serviceError = new BadRequestException('Validation failed');

      mockCampaignsService.create.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.create(createDto, mockAdminPayload))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return paginated campaigns', async () => {
      // Arrange
      const query = { limit: 10, offset: 0 };
      const expectedResult = {
        data: [mockCampaign],
        meta: { total: 1, limit: 10, offset: 0 },
      };

      mockCampaignsService.findAll.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.findAll(query);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findOne', () => {
    it('should return campaign by id', async () => {
      // Arrange
      const campaignId = '550e8400-e29b-41d4-a716-446655440000';
      mockCampaignsService.findOne.mockResolvedValue(mockCampaign);

      // Act
      const result = await controller.findOne(campaignId);

      // Assert
      expect(result).toEqual(mockCampaign);
      expect(service.findOne).toHaveBeenCalledWith(campaignId);
    });

    it('should handle campaign not found error', async () => {
      // Arrange
      const campaignId = 'non-existent-id';
      const serviceError = new NotFoundException('Campaign not found');

      mockCampaignsService.findOne.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.findOne(campaignId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update campaign successfully', async () => {
      // Arrange
      const campaignId = '550e8400-e29b-41d4-a716-446655440000';
      const updateDto = {
        name: 'Updated Campaign',
      };
      const expectedResult = { message: 'Campaign updated successfully' };

      mockCampaignsService.update.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.update(campaignId, updateDto, mockAdminPayload);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.update).toHaveBeenCalledWith(campaignId, updateDto, mockAdminPayload.id);
    });
  });

  describe('remove', () => {
    it('should delete campaign successfully', async () => {
      // Arrange
      const campaignId = '550e8400-e29b-41d4-a716-446655440000';
      const expectedResult = { message: 'Campaign deleted successfully' };

      mockCampaignsService.remove.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.remove(campaignId, mockAdminPayload);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.remove).toHaveBeenCalledWith(campaignId, mockAdminPayload.id);
    });
  });

  describe('send', () => {
    it('should send campaign successfully', async () => {
      // Arrange
      const campaignId = '550e8400-e29b-41d4-a716-446655440000';
      const expectedResult = { message: 'Campaign sent successfully' };

      mockCampaignsService.send.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.send(campaignId, mockAdminPayload);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(service.send).toHaveBeenCalledWith(campaignId, mockAdminPayload.id);
    });
  });
});