import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  UseGuards,
  Query,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
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
import { ParseUUIDPipe } from 'src/common/pipe/parse-uuid.pipe';
import { AuthenticatedRequest } from 'src/common/types/authenticated-request.type';

@ApiTags('Templates')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @SetPermissions('create:template')
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
    enum: ['Draft', 'Open', 'Deleted'],
    description: 'Filter by status',
  })
  @ApiQuery({
    name: 'language',
    required: false,
    enum: ['uz', 'ru', 'en'],
    description: 'Filter by language',
  })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search' })
  @ApiResponse({ status: 200, description: 'List of templates.' })
  async findAll(
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 10,
    @Query('offset', new ParseIntPipe({ optional: true })) offset = 0,
    @Query('status') status?: string,
    @Query('language') language?: string,
    @Query('search') search?: string,
  ): Promise<ITemplateWithHistories[]> {
    return this.templatesService.findAll({ limit, offset, status, language, search });
  }

  @Get(':template_id')
  @ApiOperation({ summary: 'Get template by ID' })
  @ApiResponse({ status: 200, description: 'Template found.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  async findOne(@Param('template_id', ParseUUIDPipe) id: string): Promise<ITemplate> {
    return this.templatesService.findOne(id);
  }

  @Put(':template_id')
  @UseGuards(PermissionsGuard)
  @SetPermissions('update:template')
  @ApiOperation({ summary: 'Update template and save history' })
  @ApiResponse({ status: 200, description: 'Updated.' })
  async update(
    @Param('template_id', ParseUUIDPipe) id: string,
    @Body() updateTemplateDto: UpdateTemplateDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    return this.templatesService.update(id, updateTemplateDto, req.admin);
  }

  @Delete(':template_id')
  @UseGuards(PermissionsGuard)
  @SetPermissions('delete:template')
  @ApiOperation({ summary: 'Delete template' })
  @ApiResponse({ status: 200, description: 'Deleted.' })
  async remove(@Param('template_id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
    return this.templatesService.remove(id);
  }
}
