import { Controller, Post, Body, UseGuards, Headers, Req } from '@nestjs/common';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { UserPayload } from 'src/common/types/user-payload.interface';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SmsDto } from './dto/sms.dto';
import { VerifyDto } from './dto/verify.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { CurrentAdmin } from 'src/common/decorators/current-admin.decorator';
import { AdminPayload } from 'src/common/types/admin-payload.interface';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }
    @Post('send-code')
    sendCode(@Body() dto: SmsDto) {
        return this.authService.sendVerificationCode(dto);
    }

    @Post('verify-code')
    verifyCode(@Body() dto: VerifyDto) {
        return this.authService.verifyCode(dto);
    }

    @Post('register')
    completeRegister(
        @Body() dto: RegisterDto,
    ) {
        return this.authService.completeRegistration(dto);
    }

    @Post('login')
    login(
        @Body() dto: LoginDto,
    ) {
        return this.authService.login(dto);
    }


    @ApiBearerAuth()
    @UseGuards(JwtAdminAuthGuard)
    @Post('logout')
    logout(@CurrentAdmin() admin: AdminPayload) {
        return this.authService.logout(admin.id);
    }



    @Post('forgot-password')
    forgotPassword(@Body() dto: ForgotPasswordDto) {
        return this.authService.forgotPassword(dto);
    }

    @Post('reset-password')
    resetPassword(@Body() dto: ResetPasswordDto) {
        return this.authService.resetPassword(dto);
    }
}
