import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
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
  async create(@CurrentAdmin() admin: AdminPayload, @Body() dto: CreateProblemCategoryDto) {
    return this.service.create(dto, admin.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get root-level problems by phone_category_id' })
  @ApiQuery({ name: 'phone_category_id', required: true, description: 'Phone category ID (UUID)' })
  @ApiResponse({ status: 200, description: 'List of root-level problems' })
  findAll(@Query('phone_category_id', new ParseUUIDPipe()) phoneCategoryId: string) {
    return this.service.findAll(phoneCategoryId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get problem by ID with breadcrumb and children' })
  @ApiParam({ name: 'id', description: 'Problem category ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Problem with breadcrumb and children' })
  @ApiResponse({ status: 404, description: 'Problem not found' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @SetPermissions('problem-category.update')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProblemCategoryDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/sort')
  @UseGuards(PermissionsGuard)
  @SetPermissions('problem-category.update')
  async updateSort(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProblemCategorySortDto,
  ) {
    return this.service.updateSort(id, dto.sort);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @SetPermissions('problem-category.delete')
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.delete(id);
  }
}
