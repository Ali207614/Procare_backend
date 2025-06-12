import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ProblemCategoriesService } from './problem-categories.service';
import { CreateProblemCategoryDto } from './dto/create-problem-category.dto';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { PermissionsGuard } from 'src/common/guards/permission.guard';
import { SetPermissions } from 'src/common/decorators/permission-decorator';
import { CurrentAdmin } from 'src/common/decorators/current-admin.decorator';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { ParseUUIDPipe } from 'src/common/pipe/parse-uuid.pipe';
import { UpdateProblemCategorySortDto } from './dto/update-problem-category-sort.dto';

@ApiTags('Problem Categories')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('problem-categories')
export class ProblemCategoriesController {
    constructor(private readonly service: ProblemCategoriesService) { }

    @Post()
    @UseGuards(PermissionsGuard)
    @SetPermissions('problem-category.create')
    @ApiOperation({ summary: 'Create new problem category' })
    @ApiResponse({ status: 201, description: 'Problem category created successfully' })
    @ApiResponse({ status: 400, description: 'Validation failed' })
    async create(
        @CurrentAdmin() admin: AdminPayload,
        @Body() dto: CreateProblemCategoryDto,
    ) {
        return this.service.create(dto, admin.id);
    }

    @Get()
    @UseGuards(PermissionsGuard)
    @SetPermissions('problem-category.view')
    @ApiOperation({ summary: 'List all problem categories' })
    async findAll(
        @Query('parent_id', ParseUUIDPipe) parent_id?: string,
        @Query() query?: PaginationQueryDto,
    ) {
        return this.service.findAll(parent_id, query);
    }

    @Patch(':id')
    @UseGuards(PermissionsGuard)
    @SetPermissions('problem-category.update')
    async update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: Partial<CreateProblemCategoryDto>
    ) {
        return this.service.update(id, dto);
    }

    @Patch(':id/sort')
    @UseGuards(PermissionsGuard)
    @SetPermissions('problem-category.update')
    async updateSort(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateProblemCategorySortDto
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