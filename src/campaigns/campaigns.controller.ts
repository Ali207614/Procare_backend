import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Query,
  Body,
  Param,
  ValidationPipe,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CampaignsService } from './campaigns.service';
import { ICampaign } from 'src/common/types/campaign.interface';
import { CreateCampaignDto } from 'src/campaigns/dto/create-campaign.dto';
import { FindAllCampaignsDto } from 'src/campaigns/dto/find-all-campaigns.dto';
import { UpdateCampaignDto } from 'src/campaigns/dto/update-campaign.dto';
import { ParseUUIDPipe } from 'src/common/pipe/parse-uuid.pipe';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { PermissionsGuard } from 'src/common/guards/permission.guard';
import { SetPermissions } from 'src/common/decorators/permission-decorator';
import { PaginationResult } from 'src/common/utils/pagination.util';
import { PaginationInterceptor } from 'src/common/interceptors/pagination.interceptor';
import { FindAllRecipientsDto } from 'src/campaigns/dto/find-all-recipients.dto';
import { ICampaignRecipient } from 'src/common/types/campaign-recipient.interface';

@ApiTags('Campaigns')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @SetPermissions('campaign.create')
  @ApiOperation({ summary: 'Create a new campaign' })
  async create(@Body(ValidationPipe) createCampaignDto: CreateCampaignDto): Promise<ICampaign> {
    return this.campaignsService.create(createCampaignDto);
  }

  @Get()
  @UseInterceptors(PaginationInterceptor)
  @ApiOperation({ summary: 'Get all campaigns with pagination and filters' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of campaigns',
    type: FindAllCampaignsDto,
  })
  async findAll(
    @Query(ValidationPipe) filters: FindAllCampaignsDto,
  ): Promise<PaginationResult<ICampaign>> {
    return this.campaignsService.findAll(filters);
  }

  @Get(':campaign_id/recipients')
  @UseInterceptors(PaginationInterceptor)
  @ApiOperation({
    summary: 'Get campaign recipients (with filters, search, sorting, and pagination)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of campaign recipients with user details',
    type: FindAllRecipientsDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Campaign not found',
  })
  async findRecipients(
    @Param('campaign_id', ParseUUIDPipe) id: string,
    @Query(ValidationPipe) filters: FindAllRecipientsDto,
  ): Promise<PaginationResult<ICampaignRecipient>> {
    return this.campaignsService.findRecipients(id, filters);
  }

  @Get(':campaign_id')
  @ApiOperation({ summary: 'Get a campaign by ID' })
  @ApiResponse({ status: 400, description: 'Campaign not found' })
  async findOne(@Param('campaign_id', ParseUUIDPipe) id: string): Promise<ICampaign> {
    return this.campaignsService.findOne(id);
  }

  @Patch(':campaign_id')
  @ApiOperation({ summary: 'Update a campaign by ID' })
  @ApiResponse({ status: 400, description: 'Campaign not found' })
  @UseGuards(PermissionsGuard)
  @SetPermissions('campaign.update')
  async update(
    @Param('campaign_id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) updateCampaignDto: UpdateCampaignDto,
  ): Promise<ICampaign> {
    return this.campaignsService.update(id, updateCampaignDto);
  }

  @Delete(':campaign_id')
  @ApiOperation({ summary: 'Delete a campaign by ID' })
  @ApiOkResponse()
  @ApiResponse({ status: 400, description: 'Campaign not found' })
  @UseGuards(PermissionsGuard)
  @SetPermissions('campaign.delete')
  async remove(@Param('campaign_id', ParseUUIDPipe) id: string): Promise<void> {
    return this.campaignsService.remove(id);
  }

  @Patch(':campaign_id/pause')
  @UseGuards(PermissionsGuard)
  @SetPermissions('pause:campaign')
  async pause(@Param('campaign_id') id: string): Promise<{ message: string }> {
    await this.campaignsService.pauseCampaign(id);
    return { message: `Campaign ${id} paused` };
  }

  @Patch(':campaign_id/resume')
  @UseGuards(PermissionsGuard)
  @SetPermissions('resume:campaign')
  async resume(@Param('campaign_id') id: string): Promise<{ message: string }> {
    await this.campaignsService.resumeCampaign(id);
    return { message: `Campaign ${id} resumed` };
  }
}
