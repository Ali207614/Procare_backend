import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { SetPermissions } from 'src/common/decorators/permission-decorator';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { PermissionsGuard } from 'src/common/guards/permission.guard';
import { PaginationResult } from 'src/common/utils/pagination.util';
import { UserPayload } from 'src/common/types/user-payload.interface';
import { WarrantyDocument } from 'src/common/types/warranty-document.interface';
import { PermissionsService } from 'src/permissions/permissions.service';
import { CreateWarrantyDocumentDto } from './dto/create-warranty-document.dto';
import { FindAllWarrantyDocumentsDto } from './dto/find-all-warranty-documents.dto';
import { PaginatedWarrantyDocumentsDto, WarrantyDocumentDto } from './dto/warranty-document.dto';
import { WarrantyDocumentPdfUrlDto } from './dto/warranty-document-pdf-url.dto';
import { WarrantyDocumentsService } from './warranty-documents.service';
import { CurrentAdmin } from 'src/common/decorators/current-admin.decorator';
import { AdminPayload } from 'src/common/types/admin-payload.interface';

@ApiTags('Warranty Documents')
@ApiExtraModels(WarrantyDocumentDto, PaginatedWarrantyDocumentsDto)
@Controller('warranty-documents')
export class WarrantyDocumentsController {
  constructor(
    private readonly warrantyDocumentsService: WarrantyDocumentsService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @ApiOperation({
    summary: 'Get warranty documents (paginated for managers, latest active for others)',
  })
  @ApiBearerAuth()
  @ApiOkResponse({
    description:
      'Returns a paginated list of warranty documents for managers, or the latest active warranty document for regular users.',
    type: PaginatedWarrantyDocumentsDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden - missing permissions' })
  @UseGuards(JwtAdminAuthGuard, PermissionsGuard)
  @SetPermissions('warranty_documents.view_all', 'warranty_documents.view')
  @Get()
  async findAll(
    @CurrentUser() user: UserPayload,
    @Query() findAllWarrantyDocumentsDto: FindAllWarrantyDocumentsDto,
  ): Promise<PaginationResult<WarrantyDocument>> {
    const userPermissions = await this.permissionsService.getPermissions(user.id);
    if (userPermissions.includes('warranty_documents.view_all')) {
      return this.warrantyDocumentsService.findAll(findAllWarrantyDocumentsDto);
    }
    const warrantyDocument = await this.warrantyDocumentsService.findActive();
    return { rows: [warrantyDocument], total: 1, limit: 1, offset: 0 };
  }

  @ApiOperation({ summary: 'Get current warranty document PDF URL' })
  @ApiBearerAuth()
  @ApiOkResponse({
    description: 'Returns a temporary URL for the current active warranty document PDF.',
    type: WarrantyDocumentPdfUrlDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden - missing permissions' })
  @UseGuards(JwtAdminAuthGuard, PermissionsGuard)
  @SetPermissions('warranty_documents.view')
  @Get('pdf-url')
  async getPdfUrl(): Promise<WarrantyDocumentPdfUrlDto> {
    return this.warrantyDocumentsService.getPdfUrl();
  }

  @ApiOperation({ summary: 'Get a single warranty document by ID (history)' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Warranty document ID (UUID)' })
  @ApiOkResponse({ description: 'The warranty document details', type: WarrantyDocumentDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden - missing permissions' })
  @UseGuards(JwtAdminAuthGuard, PermissionsGuard)
  @SetPermissions('warranty_documents.view')
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<WarrantyDocument> {
    return this.warrantyDocumentsService.findOne(id);
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a new version of the warranty document (replaces current active one)',
  })
  @ApiCreatedResponse({
    description: 'The warranty document has been successfully created.',
    type: WarrantyDocumentDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden - missing permissions' })
  @UseGuards(JwtAdminAuthGuard, PermissionsGuard)
  @SetPermissions('warranty_documents.create', 'warranty_documents.update')
  @Post()
  async create(
    @Body() createWarrantyDocumentDto: CreateWarrantyDocumentDto,
  ): Promise<WarrantyDocument> {
    return this.warrantyDocumentsService.create(createWarrantyDocumentDto);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Soft delete a warranty document' })
  @ApiParam({ name: 'id', description: 'Warranty document ID (UUID)' })
  @ApiNoContentResponse({ description: 'The warranty document has been successfully deleted.' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden - missing permissions' })
  @UseGuards(JwtAdminAuthGuard, PermissionsGuard)
  @SetPermissions('warranty_documents.delete')
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    return this.warrantyDocumentsService.remove(id);
  }

  @ApiOperation({ summary: 'Activate an existing warranty document version' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Warranty document ID (UUID)' })
  @ApiOkResponse({ type: WarrantyDocumentDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiNotFoundResponse({ description: 'Not Found' })
  @ApiBadRequestResponse({ description: 'Bad Request' })
  @UseGuards(JwtAdminAuthGuard, PermissionsGuard)
  @SetPermissions('warranty_documents.update')
  @Patch(':id/activate')
  async activate(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<WarrantyDocument> {
    return this.warrantyDocumentsService.activate(id, admin);
  }
}
