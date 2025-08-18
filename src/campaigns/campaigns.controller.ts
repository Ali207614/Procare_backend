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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiOkResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { CampaignsService } from './campaigns.service';
import { ICampaign } from 'src/common/types/campaign.interface';
import { CreateCampaignDto } from 'src/campaigns/dto/create-campaign.dto';
import { FindAllCampaignsDto } from 'src/campaigns/dto/find-all-campaigns.dto';
import { UpdateCampaignDto } from 'src/campaigns/dto/update-campaign.dto';
import { ParseUUIDPipe } from 'src/common/pipe/parse-uuid.pipe';

@ApiTags('campaigns')
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new campaign' })
  async create(@Body(ValidationPipe) createCampaignDto: CreateCampaignDto): Promise<ICampaign> {
    return this.campaignsService.create(createCampaignDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all campaigns with pagination and filters' })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  @ApiQuery({ name: 'search', required: false, example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiQuery({ name: 'status', required: false, example: 'active' })
  async findAll(@Query(ValidationPipe) filters: FindAllCampaignsDto): Promise<ICampaign[]> {
    return this.campaignsService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a campaign by ID' })
  @ApiNotFoundResponse({ description: 'Campaign not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ICampaign> {
    return this.campaignsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a campaign by ID' })
  @ApiNotFoundResponse({ description: 'Campaign not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) updateCampaignDto: UpdateCampaignDto,
  ): Promise<ICampaign> {
    return this.campaignsService.update(id, updateCampaignDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a campaign by ID' })
  @ApiOkResponse()
  @ApiNotFoundResponse({ description: 'Campaign not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.campaignsService.remove(id);
  }
}
