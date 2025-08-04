import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
  Patch,
  Req,
  Delete,
} from '@nestjs/common';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { CurrentAdmin } from 'src/common/decorators/current-admin.decorator';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { PermissionsGuard } from 'src/common/guards/permission.guard';
import { SetPermissions } from 'src/common/decorators/permission-decorator';
import { UpdateBranchSortDto } from './dto/update-branch-sort.dto';
import { BranchExistGuard } from 'src/common/guards/branch-exist.guard';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { ParseUUIDPipe } from 'src/common/pipe/parse-uuid.pipe';
import { Branch } from 'src/common/types/branch.interface';
import { AuthenticatedRequest } from 'src/common/types/authenticated-request.type';

@ApiTags('Branches')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('branches')
export class BranchesController {
  constructor(private readonly service: BranchesService) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @SetPermissions('branch.create')
  @ApiOperation({ summary: 'Create new branch' })
  @ApiResponse({ status: 201, description: 'Branch created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  async create(@CurrentAdmin() admin: AdminPayload, @Body() dto: CreateBranchDto): Promise<Branch> {
    const adminId = admin.id;
    return this.service.create(dto, adminId);
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @SetPermissions('branch.view')
  @ApiOperation({ summary: 'Get list of active branches (paginated)' })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'search', required: false, example: 'main' })
  @ApiResponse({ status: 200, description: 'List of branches returned' })
  async findAll(@Query() query: PaginationQueryDto): Promise<Branch[]> {
    const { offset, limit, search } = query;
    return this.service.findAll(offset, limit, search);
  }

  @Get('viewable')
  @ApiOperation({ summary: 'Get branches assigned to current admin' })
  @ApiResponse({ status: 200, description: 'List of assigned branches returned' })
  async findMyBranches(@CurrentAdmin() admin: AdminPayload): Promise<Branch[]> {
    return this.service.findByAdminId(admin.id);
  }

  @Get('/:branch_id')
  @UseGuards(PermissionsGuard)
  @SetPermissions('branch.view')
  @ApiOperation({ summary: 'Get branch by ID' })
  @ApiParam({ name: 'branch_id', description: 'Branch ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Branch returned successfully' })
  @ApiResponse({ status: 404, description: 'Branch not found' })
  async findOne(@Param('branch_id', ParseUUIDPipe) branchId: string): Promise<Branch> {
    return this.service.findOne(branchId);
  }

  @Patch(':branch_id/sort')
  @UseGuards(PermissionsGuard, BranchExistGuard)
  @SetPermissions('branch.update')
  @ApiOperation({ summary: 'Update branch sort order' })
  @ApiParam({ name: 'branch_id', description: 'Branch ID' })
  @ApiResponse({ status: 200, description: 'Sort updated' })
  @ApiResponse({ status: 404, description: 'Branch not found' })
  async updateSort(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateBranchSortDto,
  ): Promise<{ message: string }> {
    return this.service.updateSort(req.branch, dto.sort);
  }

  @Patch(':branch_id')
  @UseGuards(PermissionsGuard, BranchExistGuard)
  @SetPermissions('branch.update')
  @ApiOperation({ summary: 'Update branch by ID' })
  @ApiParam({ name: 'branch_id', description: 'Branch ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Branch updated successfully' })
  @ApiResponse({ status: 404, description: 'Branch not found' })
  async update(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateBranchDto,
  ): Promise<{ message: string }> {
    return this.service.update(req.branch, dto);
  }

  @Delete(':branch_id')
  @UseGuards(PermissionsGuard, BranchExistGuard)
  @SetPermissions('branch.delete')
  @ApiOperation({ summary: 'Delete branch by ID (soft delete)' })
  @ApiParam({ name: 'id', description: 'Branch ID (UUID)' })
  async delete(@Req() req: AuthenticatedRequest): Promise<{ message: string }> {
    return this.service.delete(req.branch);
  }
}
