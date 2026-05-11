import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { ProblemCategoriesService } from './problem-categories.service';
import { CreateProblemCategoryDto } from './dto/create-problem-category.dto';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { PermissionsGuard } from 'src/common/guards/permission.guard';
import { SetPermissions } from 'src/common/decorators/permission-decorator';
import { CurrentAdmin } from 'src/common/decorators/current-admin.decorator';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { ParseUUIDPipe } from 'src/common/pipe/parse-uuid.pipe';
import { UpdateProblemCategorySortDto } from './dto/update-problem-category-sort.dto';
import { UpdateProblemCategoryDto } from './dto/update-problem-category.dto';
import { FindAllProblemCategoriesDto } from 'src/problem-categories/dto/find-all-problem-categories.dto';
import { PaginationInterceptor } from 'src/common/interceptors/pagination.interceptor';
import {
  ErrorResponseDto,
  MessageResponseDto,
  ProblemCategoryPaginationResponseDto,
  ProblemCategoryResponseDto,
} from './dto/problem-category-response.dto';
import { ProblemCategory } from 'src/common/types/problem-category.interface';

@ApiTags('Problem Categories')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Unauthorized' })
@ApiForbiddenResponse({ description: 'Forbidden - Missing required permissions' })
@UseGuards(JwtAdminAuthGuard)
@Controller('problem-categories')
export class ProblemCategoriesController {
  constructor(private readonly service: ProblemCategoriesService) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @SetPermissions('problem.category.create')
  @ApiOperation({
    summary: 'Create new problem category',
    description:
      'Creates a new problem category. Either phone_category_id (for root problems) or parent_id (for sub-problems) must be provided.',
  })
  @ApiResponse({
    status: 201,
    description: 'Problem category created successfully',
    type: ProblemCategoryResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation failed or logic conflict',
    type: ErrorResponseDto,
  })
  async create(
    @CurrentAdmin() admin: AdminPayload,
    @Body() dto: CreateProblemCategoryDto,
  ): Promise<ProblemCategory> {
    return this.service.create(dto, admin.id);
  }

  @Get()
  @UseInterceptors(PaginationInterceptor)
  @ApiOperation({
    summary: 'Get root-level or child problems with breadcrumb',
    description:
      'Retrieves a paginated list of problem categories. Requires either phone_category_id or parent_id.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of problem categories with pagination and breadcrumbs',
    type: ProblemCategoryPaginationResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid query parameters', type: ErrorResponseDto })
  async find(
    @Query() query: FindAllProblemCategoriesDto,
  ): Promise<ProblemCategoryPaginationResponseDto> {
    if (query?.parent_id) {
      return (await this.service.findChildrenWithBreadcrumb(
        query,
      )) as unknown as ProblemCategoryPaginationResponseDto;
    }

    if (query?.phone_category_id) {
      return (await this.service.findRootProblems(
        query,
      )) as unknown as ProblemCategoryPaginationResponseDto;
    }

    throw new BadRequestException({
      message: 'Either phone_category_id or parent_id is required',
      location: 'query',
    });
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @SetPermissions('problem.category.update')
  @ApiOperation({ summary: 'Update problem category' })
  @ApiParam({ name: 'id', description: 'Problem category UUID' })
  @ApiResponse({
    status: 200,
    description: 'Problem category updated successfully',
    type: MessageResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Problem category not found', type: ErrorResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed', type: ErrorResponseDto })
  async update(
    @CurrentAdmin() admin: AdminPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProblemCategoryDto,
  ): Promise<{ message: string }> {
    return this.service.update(id, dto, admin.id);
  }

  @Patch(':id/sort')
  @HttpCode(200)
  @UseGuards(PermissionsGuard)
  @SetPermissions('problem.category.update')
  @ApiOperation({ summary: 'Update problem category sort order' })
  @ApiParam({ name: 'id', description: 'Problem category UUID' })
  @ApiBody({ type: UpdateProblemCategorySortDto })
  @ApiResponse({
    status: 200,
    description: 'Sort order updated successfully',
    type: MessageResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Problem category not found', type: ErrorResponseDto })
  async updateSort(
    @CurrentAdmin() admin: AdminPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProblemCategorySortDto,
  ): Promise<{ message: string }> {
    return this.service.updateSort(id, dto.sort, admin.id);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @SetPermissions('problem.category.delete')
  @ApiOperation({ summary: 'Delete problem category (Soft delete)' })
  @ApiParam({ name: 'id', description: 'Problem category UUID' })
  @ApiResponse({
    status: 200,
    description: 'Problem category deleted successfully',
    type: MessageResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Problem category not found', type: ErrorResponseDto })
  @ApiBadRequestResponse({
    description: 'Cannot delete category with active children',
    type: ErrorResponseDto,
  })
  async delete(
    @CurrentAdmin() admin: AdminPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    return this.service.delete(id, admin.id);
  }
}
