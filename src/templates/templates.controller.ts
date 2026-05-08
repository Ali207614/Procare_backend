import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Query,
  Req,
  UseInterceptors,
  Patch,
} from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
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
import { FindAllTemplatesDto } from 'src/templates/dto/find-all.dto';
import { PaginationResult } from 'src/common/utils/pagination.util';
import { PaginationInterceptor } from 'src/common/interceptors/pagination.interceptor';

@ApiTags('Templates')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @SetPermissions('template.create')
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
  @UseInterceptors(PaginationInterceptor)
  @ApiOperation({ summary: 'Get all templates (with pagination and filters)' })
  @ApiResponse({
    status: 200,
    description: 'List of templates with histories.',
    type: FindAllTemplatesDto,
  })
  async findAll(
    @Query() dto: FindAllTemplatesDto,
  ): Promise<PaginationResult<ITemplateWithHistories>> {
    return this.templatesService.findAll(dto);
  }

  @Get(':template_id')
  @ApiOperation({ summary: 'Get template by ID' })
  @ApiResponse({ status: 200, description: 'Template found.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  async findOne(@Param('template_id', ParseUUIDPipe) id: string): Promise<ITemplate> {
    return this.templatesService.findOne(id);
  }

  @Patch(':template_id')
  @UseGuards(PermissionsGuard)
  @SetPermissions('template.update')
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
  @SetPermissions('template.delete')
  @ApiOperation({ summary: 'Delete template' })
  @ApiResponse({ status: 200, description: 'Deleted.' })
  async remove(@Param('template_id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
    return this.templatesService.remove(id);
  }
}
