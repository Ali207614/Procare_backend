import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { PermissionsService } from './permissions.service';

@ApiTags('Permissions')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('permissions')
export class PermissionsController {
    constructor(private readonly permissionsService: PermissionsService) { }

    @Get()
    @ApiQuery({ name: 'search', required: false, type: String })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'offset', required: false, type: Number })
    @ApiQuery({ name: 'sortBy', required: false, enum: ['name', 'description', 'created_at'] })
    @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
    async findAll(
        @Query('search') search?: string,
        @Query('limit') limit = 20,
        @Query('offset') offset = 0,
        @Query('sortBy') sortBy = 'name',
        @Query('sortOrder') sortOrder: 'asc' | 'desc' = 'desc',
    ) {
        return this.permissionsService.findAll({
            search,
            limit,
            offset,
            sortBy,
            sortOrder,
        });
    }
}
