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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
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
import { FindAllRepairOrdersQueryDto } from 'src/repair-orders/dto/find-all-repair-orders.dto';
import {
  UpdateClientInfoDto,
  UpdateProductDto,
  UpdateProblemDto,
  CreateInitialMappingDto,
  UpdateMappingDto,
  TransferBranchDto
} from './dto';

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
  @ApiOperation({ summary: 'Get all repair orders by branchId (can_view only)' })
  findAllByBranch(
    @Req() req: AuthenticatedRequest,
    @Query() query: FindAllRepairOrdersQueryDto,
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

  @Patch(':repair_order_id/client')
  @ApiOperation({ summary: 'Update client information' })
  @ApiParam({ name: 'repair_order_id', description: 'Repair Order ID' })
  updateClientInfo(
    @Param('repair_order_id', ParseUUIDPipe) repairOrderId: string,
    @Body() updateClientDto: UpdateClientInfoDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<any> {
    return this.service.updateClientInfo(repairOrderId, updateClientDto, req.admin);
  }

  @Patch(':repair_order_id/product')
  @ApiOperation({ summary: 'Update product information' })
  @ApiParam({ name: 'repair_order_id', description: 'Repair Order ID' })
  updateProduct(
    @Param('repair_order_id', ParseUUIDPipe) repairOrderId: string,
    @Body() updateDto: UpdateProductDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<any> {
    return this.service.updateProduct(repairOrderId, updateDto, req.admin);
  }

  @Patch(':repair_order_id/problems/:problem_id')
  @ApiOperation({ summary: 'Update problem details' })
  @ApiParam({ name: 'repair_order_id', description: 'Repair Order ID' })
  @ApiParam({ name: 'problem_id', description: 'Problem ID' })
  updateProblem(
    @Param('repair_order_id', ParseUUIDPipe) repairOrderId: string,
    @Param('problem_id', ParseUUIDPipe) problemId: string,
    @Body() updateDto: UpdateProblemDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<any> {
    return this.service.updateProblem(repairOrderId, problemId, updateDto, req.admin);
  }

  @Post(':repair_order_id/initial-mapping')
  @ApiOperation({ summary: 'Create initial problem mapping' })
  @ApiParam({ name: 'repair_order_id', description: 'Repair Order ID' })
  createInitialMapping(
    @Param('repair_order_id', ParseUUIDPipe) repairOrderId: string,
    @Body() createDto: CreateInitialMappingDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<any> {
    return this.service.createInitialMapping(repairOrderId, createDto, req.admin);
  }

  @Patch(':repair_order_id/initial-mapping/:mapping_id')
  @ApiOperation({ summary: 'Update initial problem mapping' })
  @ApiParam({ name: 'repair_order_id', description: 'Repair Order ID' })
  @ApiParam({ name: 'mapping_id', description: 'Mapping ID' })
  updateInitialMapping(
    @Param('repair_order_id', ParseUUIDPipe) repairOrderId: string,
    @Param('mapping_id', ParseUUIDPipe) mappingId: string,
    @Body() updateDto: UpdateMappingDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<any> {
    return this.service.updateInitialMapping(repairOrderId, mappingId, updateDto, req.admin);
  }

  @Post(':repair_order_id/final-mapping')
  @ApiOperation({ summary: 'Create final problem mapping' })
  @ApiParam({ name: 'repair_order_id', description: 'Repair Order ID' })
  createFinalMapping(
    @Param('repair_order_id', ParseUUIDPipe) repairOrderId: string,
    @Body() createDto: CreateInitialMappingDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<any> {
    return this.service.createFinalMapping(repairOrderId, createDto, req.admin);
  }

  @Patch(':repair_order_id/final-mapping/:mapping_id')
  @ApiOperation({ summary: 'Update final problem mapping' })
  @ApiParam({ name: 'repair_order_id', description: 'Repair Order ID' })
  @ApiParam({ name: 'mapping_id', description: 'Mapping ID' })
  updateFinalMapping(
    @Param('repair_order_id', ParseUUIDPipe) repairOrderId: string,
    @Param('mapping_id', ParseUUIDPipe) mappingId: string,
    @Body() updateDto: UpdateMappingDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<any> {
    return this.service.updateFinalMapping(repairOrderId, mappingId, updateDto, req.admin);
  }

  @Patch(':repair_order_id/transfer-branch')
  @ApiOperation({ summary: 'Transfer repair order to different branch' })
  @ApiParam({ name: 'repair_order_id', description: 'Repair Order ID' })
  transferBranch(
    @Param('repair_order_id', ParseUUIDPipe) repairOrderId: string,
    @Body() transferDto: TransferBranchDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<any> {
    return this.service.transferBranch(repairOrderId, transferDto, req.admin);
  }
}
