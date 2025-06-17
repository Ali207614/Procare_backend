import { Controller, Post, Body, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { RepairOrderStatusPermissionsService } from './repair-order-status-permissions.service';
import { AssignRepairOrderStatusPermissionsDto } from './dto/create-repair-order-status-permission.dto';
import { ParseUUIDPipe } from 'src/common/pipe/parse-uuid.pipe';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { PermissionsGuard } from 'src/common/guards/permission.guard';
import { SetPermissions } from 'src/common/decorators/permission-decorator';
import { BranchExistGuard } from 'src/common/guards/branch-exist.guard';


@ApiTags('Repair Order Status Permissions')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('repair-order-status-permissions')
export class RepairOrderStatusPermissionsController {
    constructor(
        private readonly service: RepairOrderStatusPermissionsService,
    ) { }

    @Post('bulk-assign')
    @UseGuards(PermissionsGuard, BranchExistGuard)
    @SetPermissions('repair_order_status_permissions.manage')
    @ApiOperation({ summary: 'Bulk assign or update permissions to multiple admins' })
    async bulkAssign(
        @Body() dto: AssignRepairOrderStatusPermissionsDto,
    ) {
        return this.service.createMany(dto);
    }

    @Get('by-status/:id')
    @ApiOperation({ summary: 'Get permissions by status ID (with Redis caching)' })
    @ApiParam({ name: 'id', description: 'Repair Order Status ID' })
    async findByStatus(@Param('id', ParseUUIDPipe) id: string) {
        return this.service.findByStatusId(id);
    }

    @Get('by-admin/:adminId/status/:statusId')
    @ApiOperation({ summary: 'Get permission for a specific admin and status (from Redis)' })
    @ApiParam({ name: 'adminId', description: 'Admin ID' })
    @ApiParam({ name: 'statusId', description: 'Status ID' })
    async getByAdminStatus(
        @Param('adminId', ParseUUIDPipe) adminId: string,
        @Param('statusId', ParseUUIDPipe) statusId: string,
    ) {
        return this.service.findByAdminStatus(adminId, statusId);
    }

    @Get('by-admin/:adminId/branch/:branchId')
    @ApiOperation({ summary: 'Get permission for a specific admin and status (from Redis)' })
    @ApiParam({ name: 'adminId', description: 'Admin ID' })
    @ApiParam({ name: 'branchId', description: 'Branch ID' })
    async getByAdminBranch(
        @Param('adminId', ParseUUIDPipe) adminId: string,
        @Param('branchId', ParseUUIDPipe) branchId: string,
    ) {
        return this.service.findByAdminBranch(adminId, branchId);
    }
}
