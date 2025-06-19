import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { PermissionsGuard } from 'src/common/guards/permission.guard';
import { SetPermissions } from 'src/common/decorators/permission-decorator';
import { FindAllUsersDto } from './dto/find-all-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiBearerAuth()
@UseGuards(JwtAdminAuthGuard)
@ApiTags('Admins')
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Post()
    @UseGuards(PermissionsGuard)
    @SetPermissions('user.manage.create')
    @ApiOperation({ summary: 'Create new user' })
    async create(@Body() dto: CreateUserDto) {
        return this.usersService.create(dto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all users with search and pagination' })
    async findAll(@Query() query: FindAllUsersDto) {
        return this.usersService.findAll(query);
    }

    @Patch(':id')
    @UseGuards(PermissionsGuard)
    @SetPermissions('user.manage.update')
    @ApiOperation({ summary: 'Update user' })
    async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
        return this.usersService.update(id, dto);
    }

    @Delete(':id')
    @UseGuards(PermissionsGuard)
    @SetPermissions('user.manage.delete')
    @ApiOperation({ summary: 'Soft delete user' })
    async delete(@Param('id', ParseUUIDPipe) id: string) {
        return this.usersService.delete(id);
    }
}
