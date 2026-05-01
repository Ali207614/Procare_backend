import { Controller, Post, Body, Param, Get, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { RepairOrderStatusTransitionsService } from './repair-order-status-transitions.service';
import { CreateRepairOrderStatusTransitionDto } from './dto/create-repair-order-status-transition.dto';
import { RepairOrderStatusExistGuard } from 'src/common/guards/repair-order-status-exist.guard';
import { ParseUUIDPipe } from 'src/common/pipe/parse-uuid.pipe';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { PermissionsGuard } from 'src/common/guards/permission.guard';
import { SetPermissions } from 'src/common/decorators/permission-decorator';
import { RepairOrderStatusTransition } from 'src/common/types/repair-order-status-transition.interface';

@ApiTags('Repair Order Status Transitions')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('repair-order-status-transitions')
export class RepairOrderStatusTransitionsController {
  constructor(private readonly service: RepairOrderStatusTransitionsService) {}

  @Post(':status_id')
  @UseGuards(PermissionsGuard, RepairOrderStatusExistGuard)
  @SetPermissions('repair.status.transition')
  @ApiOperation({ summary: 'Upsert transitions (delete + insert)' })
  @ApiParam({ name: 'status_id', description: 'From status ID' })
  async upsertTransitions(
    @Param('status_id', ParseUUIDPipe) id: string,
    @Body() dto: CreateRepairOrderStatusTransitionDto,
  ): Promise<RepairOrderStatusTransition[]> {
    return this.service.create(id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all transitions' })
  @ApiQuery({ name: 'branch_id', required: false })
  @ApiQuery({ name: 'role_id', required: false })
  async findAll(
    @Query('branch_id', new ParseUUIDPipe({ isOptional: true })) branchId?: string,
    @Query('role_id', new ParseUUIDPipe({ isOptional: true })) roleId?: string,
  ): Promise<RepairOrderStatusTransition[]> {
    return this.service.findAll({ branchId, roleId });
  }
}
