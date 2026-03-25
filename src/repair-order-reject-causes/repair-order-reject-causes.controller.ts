import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RepairOrderRejectCausesService } from './repair-order-reject-causes.service';
import { RepairOrderRejectCause } from 'src/common/types/repair-order-reject-cause.interface';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { PermissionsGuard } from 'src/common/guards/permission.guard';

@ApiTags('Repair Order Reject Causes')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard, PermissionsGuard)
@Controller('repair-order-reject-causes')
export class RepairOrderRejectCausesController {
  constructor(private readonly service: RepairOrderRejectCausesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all repair order reject causes' })
  async getAll(): Promise<RepairOrderRejectCause[]> {
    return this.service.findAll();
  }
}
