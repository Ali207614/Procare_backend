import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { PermissionsGuard } from 'src/common/guards/permission.guard';
import { SetPermissions } from 'src/common/decorators/permission-decorator';
import { FindAllUsersDto } from './dto/find-all-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserWithRepairOrders } from 'src/common/types/repair-order.interface';
import { User, UserListItem } from 'src/common/types/user.interface';
import { CurrentAdmin } from 'src/common/decorators/current-admin.decorator';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { PaginationInterceptor } from 'src/common/interceptors/pagination.interceptor';
import { PaginationResult } from 'src/common/utils/pagination.util';

@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@ApiTags('Clients')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @SetPermissions('user.manage.create')
  @ApiOperation({ summary: 'Create new user' })
  async create(@Body() dto: CreateUserDto, @CurrentAdmin() admin: AdminPayload): Promise<User> {
    return this.usersService.create(dto, admin);
  }

  @Get()
  @UseInterceptors(PaginationInterceptor)
  @ApiOperation({ summary: 'Get all users with search and pagination' })
  async findAll(@Query() query: FindAllUsersDto): Promise<PaginationResult<UserListItem>> {
    return this.usersService.findAll(query);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @SetPermissions('user.manage.update')
  @ApiOperation({ summary: 'Update user' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<{ message: string }> {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @SetPermissions('user.manage.delete')
  @ApiOperation({ summary: 'Soft delete user' })
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
    return this.usersService.delete(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Find user with related repair orders' })
  async findOneWithOrders(@Param('id', ParseUUIDPipe) id: string): Promise<UserWithRepairOrders> {
    return this.usersService.findOneWithOrders(id);
  }
}
