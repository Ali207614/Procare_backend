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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PhoneCategoriesService } from './phone-categories.service';
import { CreatePhoneCategoryDto } from './dto/create-phone-category.dto';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { PermissionsGuard } from 'src/common/guards/permission.guard';
import { SetPermissions } from 'src/common/decorators/permission-decorator';
import { CurrentAdmin } from 'src/common/decorators/current-admin.decorator';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { UpdatePhoneCategoryDto } from './dto/update-phone-category.dto';
import { UpdatePhoneCategorySortDto } from './dto/update-phone-category-sort.dto';
import { ParseUUIDPipe } from 'src/common/pipe/parse-uuid.pipe';
import { FindAllPhoneCategoriesDto } from './dto/find-all-phone-categories.dto';

@ApiTags('Phone Categories')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('phone-categories')
export class PhoneCategoriesController {
  constructor(private readonly service: PhoneCategoriesService) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @SetPermissions('phone-category.create')
  @ApiOperation({ summary: 'Create new phone category' })
  @ApiResponse({ status: 201, description: 'Phone category created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  async create(@CurrentAdmin() admin: AdminPayload, @Body() dto: CreatePhoneCategoryDto) {
    return this.service.create(dto, admin.id);
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @SetPermissions('phone-category.view')
  @ApiOperation({ summary: 'List phone categories by OS and optionally by parent_id' })
  async findAll(@Query() query: FindAllPhoneCategoriesDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @SetPermissions('phone-category.view')
  @ApiOperation({ summary: 'Get one phone categories by id' })
  @ApiParam({ name: 'id', description: 'phone-category ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id/sort')
  @UseGuards(PermissionsGuard)
  @SetPermissions('phone-category.update')
  @ApiOperation({ summary: 'Update branch sort order' })
  @ApiParam({ name: 'id', description: 'phone-category ID' })
  @ApiResponse({ status: 200, description: 'Sort updated' })
  @ApiResponse({ status: 404, description: 'phone-category not found' })
  async updateSort(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePhoneCategorySortDto,
  ) {
    return this.service.updateSort(id, dto.sort);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @SetPermissions('phone-category.update')
  @ApiOperation({ summary: 'Update phone-category by ID' })
  @ApiParam({ name: 'id', description: 'phone-category ID (UUID)' })
  @ApiResponse({ status: 200, description: 'phone-category updated successfully' })
  @ApiResponse({ status: 404, description: 'phone-category not found' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePhoneCategoryDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @SetPermissions('phone-category.delete')
  @ApiOperation({ summary: 'Delete phone-category by ID (soft delete)' })
  @ApiParam({ name: 'id', description: 'phone-category ID (UUID)' })
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.delete(id);
  }
}
