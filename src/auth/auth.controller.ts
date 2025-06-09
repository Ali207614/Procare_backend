import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SmsDto } from './dto/sms.dto';
import { VerifyDto } from './dto/verify.dto';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
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
    @ApiOperation({ summary: 'Send verification code to phone number' })
    @ApiResponse({ status: 201, description: 'Verification code sent successfully' })
    @ApiResponse({ status: 400, description: 'Bad Request' })
    sendCode(@Body() dto: SmsDto) {
        return this.authService.sendVerificationCode(dto);
    }

    @Post('verify-code')
    @ApiOperation({ summary: 'Verify the received code' })
    @ApiResponse({ status: 200, description: 'Code verified successfully' })
    @ApiResponse({ status: 400, description: 'Invalid code' })
    verifyCode(@Body() dto: VerifyDto) {
        return this.authService.verifyCode(dto);
    }

    @Post('register')
    @ApiOperation({ summary: 'Complete registration' })
    @ApiResponse({ status: 201, description: 'User registered successfully' })
    completeRegister(@Body() dto: RegisterDto) {
        return this.authService.completeRegistration(dto);
    }

    @Post('login')
    @ApiOperation({ summary: 'Login and receive access token' })
    @ApiResponse({ status: 200, description: 'Login successful' })
    @ApiResponse({ status: 401, description: 'Invalid credentials' })
    login(@Body() dto: LoginDto) {
        return this.authService.login(dto);
    }

    @Post('forgot-password')
    @ApiOperation({ summary: 'Request password reset code' })
    @ApiResponse({ status: 200, description: 'Reset code sent' })
    forgotPassword(@Body() dto: ForgotPasswordDto) {
        return this.authService.forgotPassword(dto);
    }

    @Post('reset-password')
    @ApiOperation({ summary: 'Reset password using reset code' })
    @ApiResponse({ status: 200, description: 'Password reset successful' })
    resetPassword(@Body() dto: ResetPasswordDto) {
        return this.authService.resetPassword(dto);
    }

    @Post('logout')
    @ApiBearerAuth()
    @UseGuards(JwtAdminAuthGuard)
    @ApiOperation({ summary: 'Logout current admin' })
    @ApiResponse({ status: 200, description: 'Logged out successfully' })
    logout(@CurrentAdmin() admin: AdminPayload) {
        return this.authService.logout(admin.id);
    }
}
