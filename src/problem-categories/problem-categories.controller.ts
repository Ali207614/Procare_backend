import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
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
import { PhoneCategory } from 'src/common/types/phone-category.interface';
import { ProblemCategoryWithMeta } from 'src/common/types/problem-category.interface';
import { FindAllProblemCategoriesDto } from 'src/problem-categories/dto/find-all-problem-categories.dto';
import { PaginationResult } from 'src/common/utils/pagination.util';
import { PaginationInterceptor } from 'src/common/interceptors/pagination.interceptor';

@ApiTags('Problem Categories')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('problem-categories')
export class ProblemCategoriesController {
  constructor(private readonly service: ProblemCategoriesService) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @SetPermissions('problem-category.create')
  @ApiOperation({ summary: 'Create new problem category' })
  @ApiResponse({ status: 201, description: 'Problem category created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  async create(
    @CurrentAdmin() admin: AdminPayload,
    @Body() dto: CreateProblemCategoryDto,
  ): Promise<PhoneCategory> {
    return this.service.create(dto, admin.id);
  }

  @Get()
  @UseInterceptors(PaginationInterceptor)
  @ApiOperation({ summary: 'Get root-level or child problems with breadcrumb' })
  @ApiQuery({ name: 'phone_category_id', required: true })
  @ApiQuery({ name: 'parent_id', required: false })
  @ApiResponse({ status: 200, description: 'Problem list' })
  @ApiResponse({ status: 400, description: 'Invalid query' })
  async find(
    @Query() query: FindAllProblemCategoriesDto,
  ): Promise<PaginationResult<ProblemCategoryWithMeta>> {
    if (query?.parent_id) {
      return this.service.findChildrenWithBreadcrumb(query);
    }

    if (query?.phone_category_id) {
      return this.service.findRootProblems(query);
    }

    throw new BadRequestException({
      message: 'Either phone_category_id or parent_id is required',
      location: 'query',
    });
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @SetPermissions('problem-category.update')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProblemCategoryDto,
  ): Promise<{ message: string }> {
    return this.service.update(id, dto);
  }

  @Patch(':id/sort')
  @UseGuards(PermissionsGuard)
  @SetPermissions('problem-category.update')
  async updateSort(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProblemCategorySortDto,
  ): Promise<{ message: string }> {
    return this.service.updateSort(id, dto.sort);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @SetPermissions('problem-category.delete')
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
    return this.service.delete(id);
  }
}
