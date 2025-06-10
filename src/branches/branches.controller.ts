import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    UseGuards,
    Query,
} from '@nestjs/common';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiTags,
    ApiParam,
    ApiQuery,
} from '@nestjs/swagger';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { CurrentAdmin } from 'src/common/decorators/current-admin.decorator';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { PermissionsGuard } from 'src/common/guards/permission.guard';
import { SetPermissions } from 'src/common/decorators/permission-decorator';
@ApiTags('Branches')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('branches')
export class BranchesController {
    constructor(private readonly service: BranchesService) { }

    @Post()
    @UseGuards(PermissionsGuard)
    @SetPermissions('branch.create', 'branch.view')
    @ApiOperation({ summary: 'Create new branch' })
    @ApiResponse({ status: 201, description: 'Branch created successfully' })
    @ApiResponse({ status: 400, description: 'Validation failed' })
    async create(
        @CurrentAdmin() admin: AdminPayload,
        @Body() dto: CreateBranchDto,
    ) {
        const adminId = admin.id;
        return this.service.create(dto, adminId);
    }

    @Get()
    @UseGuards(PermissionsGuard)
    @SetPermissions('branch.view')
    @ApiOperation({ summary: 'Get list of active branches (paginated)' })
    @ApiQuery({ name: 'offset', required: false, example: 0 })
    @ApiQuery({ name: 'limit', required: false, example: 10 })
    @ApiQuery({ name: 'search', required: false, example: 'main' })
    @ApiResponse({ status: 200, description: 'List of branches returned' })
    async findAll(@Query() query: PaginationQueryDto) {
        const { offset, limit, search } = query;
        return this.service.findAll(offset, limit, search);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get branch by ID' })
    @ApiParam({ name: 'id', description: 'Branch ID (UUID)' })
    @ApiResponse({ status: 200, description: 'Branch returned successfully' })
    @ApiResponse({ status: 404, description: 'Branch not found' })
    async findOne(@Param('id') id: string) {
        return this.service.findOne(id);
    }
}
