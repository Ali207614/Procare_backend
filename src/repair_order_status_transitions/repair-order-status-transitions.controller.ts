import { Controller, Post, Body, Param, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
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
  async findAll(): Promise<RepairOrderStatusTransition[]> {
    return this.service.findAll();
  }
}
