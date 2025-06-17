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
} from '@nestjs/common';
import { RepairOrdersService } from './repair-orders.service';
import { SetPermissions } from 'src/common/decorators/permission-decorator';
import { PermissionsGuard } from 'src/common/guards/permission.guard';
import { CreateRepairOrderDto } from './dto/create-repair-order.dto';
import { UpdateRepairOrderDto } from './dto/update-repair-order.dto';
import { BranchExistGuard } from 'src/common/guards/branch-exist.guard';
import { RepairOrderStatusExistGuard } from 'src/common/guards/repair-order-status-exist.guard';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PaginationQuery } from 'src/common/types/pagination-query.interface';

@ApiTags('Repair Orders')
@Controller('repair-orders')
@UseGuards(PermissionsGuard)
export class RepairOrdersController {
    constructor(private readonly service: RepairOrdersService) { }

    @Post()
    @UseGuards(BranchExistGuard, RepairOrderStatusExistGuard)
    @ApiOperation({ summary: 'Create repair order' })
    create(@Req() req, @Body() dto: CreateRepairOrderDto) {
        return this.service.create(req.admin.id, req.branch.id, req.status.id, dto);
    }

    @Patch(':id')
    @UseGuards(BranchExistGuard, RepairOrderStatusExistGuard)
    @ApiOperation({ summary: 'Update repair order' })
    @ApiParam({ name: 'id', description: 'Repair Order ID' })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Req() req,
        @Body() dto: UpdateRepairOrderDto,
    ) {
        return this.service.update(req.admin.id, id, dto);
    }

    @Get()
    @UseGuards(BranchExistGuard)
    @ApiParam({ name: 'branchId' })
    @ApiQuery({ name: 'page', required: false })
    @ApiQuery({ name: 'branch_id', required: true })
    @ApiQuery({ name: 'limit', required: false })
    @ApiQuery({ name: 'sortBy', enum: ['sort', 'priority', 'created_at'], required: false })
    @ApiQuery({ name: 'sortOrder', enum: ['asc', 'desc'], required: false })
    @ApiOperation({ summary: 'Get all repair orders by branchId (can_view only)' })
    @ApiQuery({ name: 'branch_id', description: 'Branch ID', required: true })
    findAllByBranch(
        @Req() req,
        @Query('branch_id', ParseUUIDPipe) branchId: string,
        @Query() query: PaginationQuery,
    ) {
        return this.service.findAllByAdminBranch(req.admin.id, branchId, query);
    }


    @Get(':id')
    @ApiOperation({ summary: 'Get repair order by ID (with permission)' })
    @ApiParam({ name: 'id', description: 'Repair Order ID' })
    findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req) {
        //   return this.service.findById(id, req.admin.id, req.branch.id);
    }

}
