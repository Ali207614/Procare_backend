import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAdminAuthGuard } from '../common/guards/jwt-admin.guard';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AdminsService } from './admins.service';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { CurrentAdmin } from 'src/common/decorators/current-admin.decorator';
import { ClassSerializerInterceptor } from 'src/common/interceptors/class-serializer.interceptor';
import { plainToInstance } from 'class-transformer';
import { AdminProfileDto } from './dto/admin-profile.dto';
import { PermissionsGuard } from 'src/common/guards/permission.guard';
import { SetAllPermissions, SetPermissions } from 'src/common/decorators/permission-decorator';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { ParseUUIDPipe } from 'src/common/pipe/parse-uuid.pipe';
import { FindAllAdminsDto } from './dto/find-all-admins.dto';
import { Admin } from 'src/common/types/admin.interface';
import { AuthenticatedRequest } from 'src/common/types/authenticated-request.type';
import { PaginationInterceptor } from 'src/common/interceptors/pagination.interceptor';

@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@ApiTags('Employees')
@Controller('admins')
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

  @UseInterceptors(ClassSerializerInterceptor)
  @Get('me')
  getProfile(@CurrentAdmin() admin: AdminPayload): AdminProfileDto {
    const adminData = this.adminsService.findById(admin.id);
    return plainToInstance(AdminProfileDto, adminData);
  }

  @Post('change-password')
  changePassword(
    @CurrentAdmin() admin: AdminPayload,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    return this.adminsService.changePassword(admin, dto);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @SetPermissions('admin.manage.create')
  @ApiOperation({ summary: 'Create new admin (without password)' })
  async create(@CurrentAdmin() admin: AdminPayload, @Body() dto: CreateAdminDto): Promise<Admin> {
    return this.adminsService.create(admin.id, dto);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @SetPermissions('admin.manage.update', 'admin.profile.edit.basic', 'admin.profile.edit.sensitive')
  @ApiParam({ name: 'id', description: 'Admin ID' })
  @ApiOperation({ summary: 'Update admin data' })
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminDto,
  ): Promise<{ message: string }> {
    return this.adminsService.update(req.admin, id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @SetAllPermissions('admin.manage.delete')
  @ApiParam({ name: 'id', description: 'Admin ID (UUID)' })
  @ApiOperation({ summary: 'Delete admin by ID (soft delete)' })
  async delete(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    return this.adminsService.delete(req.admin, id);
  }

  @Get()
  @UseInterceptors(ClassSerializerInterceptor, PaginationInterceptor)
  @UseGuards(PermissionsGuard)
  @SetAllPermissions('admin.manage.view')
  @ApiOperation({ summary: 'Get all admins with filters and pagination' })
  async findAll(
    @Query() query: FindAllAdminsDto,
  ): Promise<{ rows: AdminProfileDto[]; total: number; limit: number; offset: number }> {
    const result = await this.adminsService.findAll(query);

    return {
      ...result,
      rows: result.rows.map((admin: Admin) => plainToInstance(AdminProfileDto, admin)),
    };
  }
}
