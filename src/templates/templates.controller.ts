import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Query } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { PermissionsGuard } from 'src/common/guards/permission.guard';
import { CreateTemplateDto } from 'src/templates/dto/create-template.dto';
import { SetPermissions } from 'src/common/decorators/permission-decorator';
import { UpdateTemplateDto } from 'src/templates/dto/update-template.dto';
import { CurrentAdmin } from 'src/common/decorators/current-admin.decorator';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { ITemplate, ITemplateWithHistories } from 'src/common/types/template.interface';

@ApiTags('Templates')
@Controller('templates')
@UseGuards(JwtAdminAuthGuard)
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @SetPermissions('create:template')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new template' })
  @ApiResponse({ status: 201, description: 'Template created.' })
  @ApiResponse({ status: 400, description: 'Invalid data.' })
  async create(
    @Body() createTemplateDto: CreateTemplateDto,
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<ITemplate> {
    return this.templatesService.create(createTemplateDto, admin);
  }

  @Get()
  @ApiOperation({ summary: 'Get all templates (with pagination and filters)' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of results (default: 10)',
  })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Offset (default: 0)' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['draft', 'active', 'archived'],
    description: 'Filter by status',
  })
  @ApiQuery({
    name: 'language',
    required: false,
    enum: ['uz', 'ru', 'en'],
    description: 'Filter by language',
  })
  @ApiResponse({ status: 200, description: 'List of templates.' })
  async findAll(
    @Query('limit') limit: number = 10,
    @Query('offset') offset: number = 0,
    @Query('status') status?: string,
    @Query('language') language?: string,
  ): Promise<ITemplateWithHistories[]> {
    return this.templatesService.findAll({ limit, offset, status, language });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get template by ID' })
  @ApiResponse({ status: 200, description: 'Template found.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  async findOne(@Param('id') id: string): Promise<ITemplate> {
    return this.templatesService.findOne(id);
  }

  @Put(':id')
  @UseGuards(PermissionsGuard)
  @SetPermissions('update:template')
  @ApiOperation({ summary: 'Update template and save history' })
  @ApiResponse({ status: 200, description: 'Updated.' })
  async update(
    @Param('id') id: string,
    @Body() updateTemplateDto: UpdateTemplateDto,
  ): Promise<{ message: string }> {
    return this.templatesService.update(id, updateTemplateDto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @SetPermissions('delete:template')
  @ApiOperation({ summary: 'Delete template' })
  @ApiResponse({ status: 200, description: 'Deleted.' })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    return this.templatesService.remove(id);
  }
}
