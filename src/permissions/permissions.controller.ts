import { Controller, Get, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { PermissionsService } from './permissions.service';
import { Permission } from 'src/common/types/permission.interface';
import { PermissionsGuard } from 'src/common/guards/permission.guard';
import { SetPermissions } from 'src/common/decorators/permission-decorator';
import { FindAllPermissionsDto } from './dto/find-all-permissions.dto';
import { PaginationInterceptor } from 'src/common/interceptors/pagination.interceptor';

@ApiTags('Permissions')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @UseInterceptors(PaginationInterceptor)
  @UseGuards(PermissionsGuard)
  @SetPermissions('permission.view')
  async findAll(@Query() query: FindAllPermissionsDto): Promise<{
    rows: Permission[];
    total: number;
    limit: number;
    offset: number;
  }> {
    return this.permissionsService.findAll(query);
  }
}
