import { Body, Controller, forwardRef, Get, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from 'src/auth/auth.service';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { UserPayload } from 'src/common/types/user-payload.interface';
import { JwtAdminAuthGuard } from '../common/guards/jwt-admin.guard';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AdminsService } from './admins.service';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { CurrentAdmin } from 'src/common/decorators/current-admin.decorator';

@ApiBearerAuth()
@ApiTags('Admins')
@Controller('admins')
export class AdminsController {
    constructor(
        private readonly adminsService: AdminsService) { }

    @UseGuards(JwtAdminAuthGuard)
    @Get('me')
    getProfile(@CurrentAdmin() admin: AdminPayload) {
        return this.adminsService.findById(admin.id);
    }

    @UseGuards(JwtAdminAuthGuard)
    @Post('change-password')
    changePassword(@CurrentAdmin() admin: AdminPayload, @Body() dto: ChangePasswordDto) {
        return this.adminsService.changePassword(admin, dto);
    }

}
