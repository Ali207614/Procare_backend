import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { PermissionsService } from './permissions.service';

@ApiTags('Permissions')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'sort_by', required: false, enum: ['name', 'description', 'created_at'] })
  @ApiQuery({ name: 'sort_order', required: false, enum: ['asc', 'desc'] })
  async findAll(
    @Query('search') search?: string,
    @Query('limit') limit = 20,
    @Query('offset') offset = 0,
    @Query('sort_by') sort_by = 'name',
    @Query('sort_order') sort_order: 'asc' | 'desc' = 'desc',
  ) {
    return this.permissionsService.findAll({
      search,
      limit,
      offset,
      sort_by,
      sort_order,
    });
  }
}
