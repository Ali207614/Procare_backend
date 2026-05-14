import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAdmin } from 'src/common/decorators/current-admin.decorator';
import { SetPermissions } from 'src/common/decorators/permission-decorator';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { PermissionsGuard } from 'src/common/guards/permission.guard';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { RepairOrderAnalyticsQueryDto } from './dto/repair-order-analytics-query.dto';
import { RepairOrderAnalyticsService } from './repair-order-analytics.service';
import { RepairOrderAnalyticsResponse } from './types/repair-order-analytics.types';

@ApiTags('Repair Order Analytics')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard, PermissionsGuard)
@SetPermissions('analytics.repair_orders.view', 'analytics.repair_orders.view_all')
@Controller('analytics/repair-orders')
export class RepairOrderAnalyticsController {
  constructor(private readonly service: RepairOrderAnalyticsService) {}

  @Get('by-operators')
  @ApiOperation({ summary: 'Repair-order lead analytics grouped by Operator admins' })
  getByOperators(
    @CurrentAdmin() admin: AdminPayload,
    @Query() query: RepairOrderAnalyticsQueryDto,
  ): Promise<RepairOrderAnalyticsResponse> {
    return this.service.getByOperators(admin, query);
  }

  @Get('by-sources')
  @ApiOperation({ summary: 'Repair-order lead analytics grouped by repair-order source' })
  getBySources(
    @CurrentAdmin() admin: AdminPayload,
    @Query() query: RepairOrderAnalyticsQueryDto,
  ): Promise<RepairOrderAnalyticsResponse> {
    return this.service.getBySources(admin, query);
  }

  @Get('by-reject-causes')
  @ApiOperation({
    summary:
      'Repair-order lead analytics grouped by reject cause for moves into Invalid statuses',
  })
  getByRejectCauses(
    @CurrentAdmin() admin: AdminPayload,
    @Query() query: RepairOrderAnalyticsQueryDto,
  ): Promise<RepairOrderAnalyticsResponse> {
    return this.service.getByRejectCauses(admin, query);
  }
}
