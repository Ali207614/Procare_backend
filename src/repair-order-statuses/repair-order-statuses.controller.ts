import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RepairOrderStatusesService } from './repair-order-statuses.service';
import { CreateRepairOrderStatusDto } from './dto/create-repair-order-status.dto';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { PermissionsGuard } from 'src/common/guards/permission.guard';
import { SetPermissions } from 'src/common/decorators/permission-decorator';
import { CurrentAdmin } from 'src/common/decorators/current-admin.decorator';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { BranchExistGuard } from 'src/common/guards/branch-exist.guard';

@ApiTags('Repair Order Statuses')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('repair-order-statuses')
export class RepairOrderStatusesController {
    constructor(private readonly service: RepairOrderStatusesService) { }

    @Post()
    @UseGuards(PermissionsGuard, BranchExistGuard)
    @SetPermissions('repair-order-status.create')
    @ApiOperation({ summary: 'Create new repair order status' })
    @ApiResponse({ status: 201, description: 'Status created successfully' })
    async create(
        @CurrentAdmin() admin: AdminPayload,
        @Body() dto: CreateRepairOrderStatusDto
    ) {
        return this.service.create(dto, admin.id);
    }

    @Get()
    @UseGuards(PermissionsGuard)
    @SetPermissions('repair-order-status.view')
    @ApiOperation({ summary: 'List all repair order statuses' })
    async findAll() {
        return this.service.findAll();
    }
}