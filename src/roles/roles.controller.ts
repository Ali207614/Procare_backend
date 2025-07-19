import { Controller, Post, Get, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { SetPermissions } from 'src/common/decorators/permission-decorator';
import { ApiTags, ApiOperation, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { PermissionsGuard } from 'src/common/guards/permission.guard';
import { CurrentAdmin } from 'src/common/decorators/current-admin.decorator';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { ParseUUIDPipe } from 'src/common/pipe/parse-uuid.pipe';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { Role } from 'src/common/types/role.interface';
import { Permission } from 'src/common/types/permission.interface';

export interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

@ApiTags('Roles')
@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly service: RolesService) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @SetPermissions('role.create')
  @ApiOperation({ summary: 'Create new role' })
  async create(@CurrentAdmin() admin: AdminPayload, @Body() dto: CreateRoleDto): Promise<Role> {
    return this.service.create(dto, admin.id);
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @SetPermissions('role.view')
  @ApiOperation({ summary: 'Get all roles' })
  async findAll(): Promise<Role[]> {
    return this.service.findAll();
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @SetPermissions('role.view')
  @ApiParam({ name: 'id', description: 'Role ID (UUID)' })
  @ApiOperation({ summary: 'Get role by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<RoleWithPermissions> {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @SetPermissions('role.update')
  @ApiOperation({ summary: 'Update role by ID' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<{ message: string }> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @SetPermissions('role.delete')
  @ApiOperation({ summary: 'Delete role by ID (soft delete)' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
    return this.service.delete(id);
  }
}
