import { Controller, Get, Post, Body, Patch, Delete, Req, UseGuards, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RepairOrderStatusesService } from './repair-order-statuses.service';
import { CreateRepairOrderStatusDto } from './dto/create-repair-order-status.dto';
import { RepairOrderStatusExistGuard } from 'src/common/guards/repair-order-status-exist.guard';
import { SetPermissions } from 'src/common/decorators/permission-decorator';
import { PermissionsGuard } from 'src/common/guards/permission.guard';
import { ParseUUIDPipe } from 'src/common/pipe/parse-uuid.pipe';
import { UpdateRepairOrderStatusDto } from './dto/update-repair-order-status.dto';
import { UpdateRepairOrderStatusSortDto } from './dto/update-repair-order-status-sort.dto';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { BranchExistGuard } from 'src/common/guards/branch-exist.guard';
import { AuthenticatedRequest } from 'src/common/types/authenticated-request.type';
import {
  RepairOrderStatus,
  RepairOrderStatusWithPermissions,
} from 'src/common/types/repair-order-status.interface';

@ApiTags('Repair Order Statuses')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('repair-order-statuses')
export class RepairOrderStatusesController {
  constructor(private readonly service: RepairOrderStatusesService) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @SetPermissions('repair_order_status.create')
  @ApiOperation({ summary: 'Create a new repair order status' })
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateRepairOrderStatusDto,
  ): Promise<RepairOrderStatus> {
    return this.service.create(dto, req.admin.id);
  }

  @Get('viewable')
  @UseGuards(PermissionsGuard, BranchExistGuard)
  @ApiOperation({ summary: 'Get viewable statuses for current admin' })
  @ApiQuery({ name: 'branch_id', required: true })
  async getViewable(
    @Req() req: AuthenticatedRequest,
    @Query('branch_id', ParseUUIDPipe) branchId: string,
  ): Promise<RepairOrderStatusWithPermissions[]> {
    return this.service.findViewable(req.admin.id, branchId);
  }

  @Get('all')
  @UseGuards(PermissionsGuard, BranchExistGuard)
  @SetPermissions('repair_order_status.view')
  @ApiOperation({ summary: 'Get all statuses for admin panel' })
  @ApiQuery({ name: 'branch_id', required: true })
  async getAll(@Query('branch_id', ParseUUIDPipe) branchId: string): Promise<RepairOrderStatus[]> {
    return this.service.findAllStatuses(branchId);
  }

  @Patch(':status_id/sort')
  @UseGuards(PermissionsGuard, RepairOrderStatusExistGuard)
  @SetPermissions('repair_order_status.update')
  @ApiOperation({ summary: 'Update status sort order' })
  @ApiParam({ name: 'status_id', description: 'Status ID (UUID)' })
  async updateSort(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateRepairOrderStatusSortDto,
  ): Promise<{ message: string }> {
    return this.service.updateSort(req.status, dto.sort);
  }

  @Patch(':status_id')
  @UseGuards(PermissionsGuard, RepairOrderStatusExistGuard)
  @SetPermissions('repair_order_status.update')
  @ApiOperation({ summary: 'Update repair order status by ID' })
  @ApiParam({ name: 'status_id', description: 'Status ID (UUID)' })
  async update(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateRepairOrderStatusDto,
  ): Promise<{ message: string }> {
    return this.service.update(req.status, dto);
  }

  @Delete(':status_id')
  @UseGuards(PermissionsGuard, RepairOrderStatusExistGuard)
  @SetPermissions('repair_order_status.delete')
  @ApiOperation({ summary: 'Soft delete repair order status by ID' })
  @ApiParam({ name: 'status_id', description: 'Status ID (UUID)' })
  async delete(@Req() req: AuthenticatedRequest): Promise<{ message: string }> {
    return this.service.delete(req.status);
  }
}
