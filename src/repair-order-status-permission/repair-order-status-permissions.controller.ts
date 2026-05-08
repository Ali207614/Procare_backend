import { Controller, Put, Body, Get, Param, UseGuards, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBearerAuth,
  ApiQuery,
  ApiOkResponse,
} from '@nestjs/swagger';
import { RepairOrderStatusPermissionsService } from './repair-order-status-permissions.service';
import { AssignRepairOrderStatusPermissionsDto } from './dto/create-repair-order-status-permission.dto';
import { ParseUUIDPipe } from 'src/common/pipe/parse-uuid.pipe';
import { ParseOptionalUUIDPipe } from 'src/common/pipe/parse-optional-uuid.pipe';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { PermissionsGuard } from 'src/common/guards/permission.guard';
import { SetPermissions } from 'src/common/decorators/permission-decorator';
import { BranchExistGuard } from 'src/common/guards/branch-exist.guard';
import { RepairOrderStatusExistGuard } from 'src/common/guards/repair-order-status-exist.guard';
import {
  RepairOrderStatusPermission,
  StatusPermissionsByRoleResponse,
} from 'src/common/types/repair-order-status-permssion.interface';

@ApiTags('Repair Order Status Permissions')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('repair-order-status-permissions')
export class RepairOrderStatusPermissionsController {
  constructor(private readonly service: RepairOrderStatusPermissionsService) {}

  @Put('bulk-assign')
  @UseGuards(PermissionsGuard, BranchExistGuard)
  @SetPermissions('repair.status.permission')
  @ApiOperation({ summary: 'Bulk assign or update permissions to multiple admins' })
  async bulkAssign(
    @Body() dto: AssignRepairOrderStatusPermissionsDto,
  ): Promise<{ message: string; count: number }> {
    return this.service.createManyByRole(dto);
  }

  @Get('by-status/:status_id')
  @UseGuards(RepairOrderStatusExistGuard)
  @ApiOperation({ summary: 'Get permissions by status ID (with Redis caching)' })
  @ApiParam({ name: 'status_id', description: 'Repair Order Status ID' })
  async findByStatus(
    @Param('status_id', ParseUUIDPipe) statusId: string,
  ): Promise<RepairOrderStatusPermission[]> {
    return this.service.findByStatusId(statusId);
  }

  @Get('by-role/:role_id')
  @ApiOperation({ summary: 'Get repair order status permissions by role' })
  @ApiParam({ name: 'role_id', description: 'Role ID' })
  @ApiQuery({
    name: 'branch_id',
    required: false,
    description: 'Branch ID',
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiOkResponse({
    description: 'Repair order status permissions by role with metadata',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { type: 'object' },
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 1 },
            role_id: {
              type: 'string',
              format: 'uuid',
              example: '00000000-0000-4000-8000-000000000001',
            },
            branch_id: {
              type: 'string',
              format: 'uuid',
              nullable: true,
              example: '00000000-0000-4000-8000-000000000020',
            },
          },
        },
      },
    },
  })
  async findByRole(
    @Param('role_id', ParseUUIDPipe) roleId: string,
    @Query('branch_id', ParseOptionalUUIDPipe) branchId?: string,
  ): Promise<StatusPermissionsByRoleResponse> {
    return this.service.findPermissionsByRole(roleId, branchId);
  }

  @Get('by-role/:role_id/status/:status_id')
  @UseGuards(RepairOrderStatusExistGuard)
  @ApiOperation({ summary: 'Get permission for a specific role and status (from Redis)' })
  @ApiParam({ name: 'role_id', description: 'Role ID' })
  @ApiParam({ name: 'status_id', description: 'Status ID' })
  async getByAdminStatus(
    @Param('role_id', ParseUUIDPipe) roleId: string,
    @Param('status_id', ParseUUIDPipe) statusId: string,
  ): Promise<RepairOrderStatusPermission | null> {
    return this.service.findByRoleStatus(roleId, statusId);
  }

  @Get('by-role/:role_id/branch/:branch_id')
  @UseGuards(BranchExistGuard)
  @ApiOperation({ summary: 'Get permission for a specific role and status (from Redis)' })
  @ApiParam({ name: 'role_id', description: 'Role ID' })
  @ApiParam({ name: 'branch_id', description: 'Branch ID' })
  async getByAdminBranch(
    @Param('role_id', ParseUUIDPipe) roleId: string,
    @Param('branch_id', ParseUUIDPipe) branchId: string,
  ): Promise<RepairOrderStatusPermission[]> {
    return this.service.findByRolesAndBranch([{ name: '', id: roleId }], branchId);
  }
}
