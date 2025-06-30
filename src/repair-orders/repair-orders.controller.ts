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

@ApiTags('Repair Orders')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('repair-orders')
export class RepairOrdersController {
  constructor(private readonly service: RepairOrdersService) {}

  @Post()
  @UseGuards(RepairOrderStatusExistGuard)
  @ApiOperation({ summary: 'Create repair order' })
  create(@Req() req, @Body() dto: CreateRepairOrderDto) {
    return this.service.create(req.admin.id, req.status.branch_id, req.status.id, dto);
  }

  @Patch(':id')
  @UseGuards(BranchExistGuard, RepairOrderStatusExistGuard)
  @ApiOperation({ summary: 'Update repair order' })
  @ApiParam({ name: 'id', description: 'Repair Order ID' })
  update(@Param('id', ParseUUIDPipe) id: string, @Req() req, @Body() dto: UpdateRepairOrderDto) {
    return this.service.update(req.admin.id, id, dto);
  }

  @Get()
  @UseGuards(BranchExistGuard)
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'sortBy', enum: ['sort', 'priority', 'created_at'], required: false })
  @ApiQuery({ name: 'sortOrder', enum: ['asc', 'desc'], required: false })
  @ApiOperation({ summary: 'Get all repair orders by branchId (can_view only)' })
  @ApiQuery({ name: 'branch_id', description: 'Branch ID', required: true })
  findAllByBranch(@Req() req, @Query() query: PaginationQuery) {
    return this.service.findAllByAdminBranch(req.admin.id, req.branch.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get repair order by ID (with permission)' })
  @ApiParam({ name: 'id', description: 'Repair Order ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req) {
    return this.service.findById(req.admin.id, id);
  }

  @Patch(':id/move')
  @UseGuards(RepairOrderStatusExistGuard)
  @ApiOperation({ summary: 'Move repair order' })
  @ApiParam({ name: 'id', description: 'Repair Order ID' })
  move(@Param('id', ParseUUIDPipe) id: string, @Req() req, @Body() dto: MoveRepairOrderDto) {
    return this.service.move(req.admin.id, id, dto);
  }

  @Patch(':id/sort')
  @UseGuards(RepairOrderStatusExistGuard)
  @ApiOperation({ summary: 'Update status sort order' })
  @ApiParam({ name: 'id', description: 'Status ID (UUID)' })
  async updateSort(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRepairOrderSortDto,
    @CurrentAdmin() admin: AdminPayload,
  ) {
    return this.service.updateSort(id, dto.sort, admin.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a repair order (with permission)' })
  @ApiParam({ name: 'id', description: 'Repair Order ID' })
  delete(@Param('id', ParseUUIDPipe) id: string, @Req() req) {
    return this.service.softDelete(req.admin.id, id);
  }
}
