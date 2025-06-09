import { Body, Controller, forwardRef, Get, Inject, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from 'src/auth/auth.service';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { UserPayload } from 'src/common/types/user-payload.interface';
import { JwtAdminAuthGuard } from '../common/guards/jwt-admin.guard';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AdminsService } from './admins.service';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { CurrentAdmin } from 'src/common/decorators/current-admin.decorator';
import { ClassSerializerInterceptor } from 'src/common/interceptors/class-serializer.interceptor';
import { plainToInstance } from 'class-transformer';
import { AdminProfileDto } from './dto/admin-profile.dto';

@ApiBearerAuth()
@ApiTags('Admins')
@Controller('admins')
export class AdminsController {
    constructor(
        private readonly adminsService: AdminsService) { }

    @UseGuards(JwtAdminAuthGuard)
    @UseInterceptors(ClassSerializerInterceptor)
    @Get('me')
    getProfile(@CurrentAdmin() admin: AdminPayload) {
        const adminData = this.adminsService.findById(admin.id);
        return plainToInstance(AdminProfileDto, adminData);

    }

    @UseGuards(JwtAdminAuthGuard)
    @Post('change-password')
    changePassword(@CurrentAdmin() admin: AdminPayload, @Body() dto: ChangePasswordDto) {
        return this.adminsService.changePassword(admin, dto);
    }

}
