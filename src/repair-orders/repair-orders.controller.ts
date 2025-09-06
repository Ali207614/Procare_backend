import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  Req,
  Query,
  Delete,
} from '@nestjs/common';
import { RepairOrdersService } from './repair-orders.service';
import { CreateRepairOrderDto } from './dto/create-repair-order.dto';
import { UpdateRepairOrderDto } from './dto/update-repair-order.dto';
import { BranchExistGuard } from 'src/common/guards/branch-exist.guard';
import { RepairOrderStatusExistGuard } from 'src/common/guards/repair-order-status-exist.guard';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PaginationQuery } from 'src/common/types/pagination-query.interface';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { MoveRepairOrderDto } from './dto/move-repair-order.dto';
import { UpdateRepairOrderSortDto } from './dto/update-repair-order-sort.dto';
import { CurrentAdmin } from 'src/common/decorators/current-admin.decorator';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { AuthenticatedRequest } from 'src/common/types/authenticated-request.type';
import {
  FreshRepairOrder,
  RepairOrder,
  RepairOrderDetails,
} from 'src/common/types/repair-order.interface';

@ApiTags('Repair Orders')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('repair-orders')
export class RepairOrdersController {
  constructor(private readonly service: RepairOrdersService) {}

  @Post()
  @UseGuards(RepairOrderStatusExistGuard)
  @ApiOperation({ summary: 'Create repair order' })
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateRepairOrderDto,
  ): Promise<RepairOrder> {
    return this.service.create(req.admin, req.status.branch_id, req.status.id, dto);
  }

  @Patch(':repair_order_id')
  @UseGuards(BranchExistGuard, RepairOrderStatusExistGuard)
  @ApiOperation({ summary: 'Update repair order' })
  @ApiParam({ name: 'repair_order_id', description: 'Repair Order ID' })
  update(
    @Param('repair_order_id', ParseUUIDPipe) repairOrderId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateRepairOrderDto,
  ): Promise<{ message: string }> {
    return this.service.update(req.admin, repairOrderId, dto);
  }

  @Get()
  @UseGuards(BranchExistGuard)
  @ApiQuery({ name: 'offset', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'sort_by', enum: ['sort', 'priority', 'created_at'], required: false })
  @ApiQuery({ name: 'sort_order', enum: ['asc', 'desc'], required: false })
  @ApiOperation({ summary: 'Get all repair orders by branchId (can_view only)' })
  @ApiQuery({ name: 'branch_id', description: 'Branch ID', required: true })
  findAllByBranch(
    @Req() req: AuthenticatedRequest,
    @Query() query: PaginationQuery,
  ): Promise<Record<string, FreshRepairOrder[]>> {
    return this.service.findAllByAdminBranch(req.admin, req.branch.id, query);
  }

  @Get(':repair_order_id')
  @ApiOperation({ summary: 'Get repair order by ID (with permission)' })
  @ApiParam({ name: 'repair_order_id', description: 'Repair Order ID' })
  findOne(
    @Param('repair_order_id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<RepairOrderDetails> {
    return this.service.findById(req.admin, id);
  }

  @Patch(':repair_order_id/move')
  @UseGuards(RepairOrderStatusExistGuard)
  @ApiOperation({ summary: 'Move repair order' })
  @ApiParam({ name: 'repair_order_id', description: 'Repair Order ID' })
  move(
    @Param('repair_order_id', ParseUUIDPipe) repairOrderId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: MoveRepairOrderDto,
  ): Promise<{ message: string }> {
    return this.service.move(req.admin, repairOrderId, dto);
  }

  @Patch(':repair_order_id/sort')
  @UseGuards(RepairOrderStatusExistGuard)
  @ApiOperation({ summary: 'Update status sort order' })
  @ApiParam({ name: 'repair_order_id', description: 'Status ID (UUID)' })
  async updateSort(
    @Param('repair_order_id', ParseUUIDPipe) repairOrderId: string,
    @Body() dto: UpdateRepairOrderSortDto,
    @CurrentAdmin() admin: AdminPayload,
  ): Promise<{ message: string }> {
    return this.service.updateSort(repairOrderId, dto.sort, admin);
  }

  @Delete(':repair_order_id')
  @ApiOperation({ summary: 'Soft delete a repair order (with permission)' })
  @ApiParam({ name: 'repair_order_id', description: 'Repair Order ID' })
  delete(
    @Param('repair_order_id', ParseUUIDPipe) repairOrderId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    return this.service.softDelete(req.admin, repairOrderId);
  }
}
