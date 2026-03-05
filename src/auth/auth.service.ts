import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import axios from 'axios';
import { normalizeUzPhone } from 'src/common/utils/phone.util';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyDto } from './dto/verify.dto';
import { SmsDto } from './dto/sms.dto';
import { RedisService } from 'src/common/redis/redis.service';
import { Knex } from 'knex';
import { InjectKnex } from 'nestjs-knex';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyForgotPasswordOtpDto } from './dto/verify-forgot-password-otp.dto';
import { AdminsService } from 'src/admins/admins.service';
import { Admin } from 'src/common/types/admin.interface';
import { SendCodeResponseDto } from './dto/send-code-response.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectKnex() private readonly knex: Knex,
    @Inject(forwardRef(() => AdminsService))
    private readonly adminsService: AdminsService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  private readonly RESET_PREFIX = 'reset-code:';
  private readonly FORGOT_PASSWORD_TOKEN_PREFIX = 'forgot-password-token:';
  private readonly REDIS_PREFIX = {
    verify: 'auth:verify_code',
    reset: 'auth:reset_code',
    pin_reset: 'auth:pin_reset_code',
    reset_token: 'auth:reset_token',
  };

  // A helper function for sending OTP code
  async sendCode(
    phone: string,
    type: 'verify' | 'reset' | 'pin_reset',
  ): Promise<SendCodeResponseDto> {
    const rateLimitKey = `rl:send_code:phone:${phone}`;
    const ttl = await this.redisService.ttl(rateLimitKey);

    if (ttl > 0) {
      throw new HttpException(
        {
          message: 'Too many requests. Please try again later.',
          location: 'auth_send_code_rate_limit',
          retry_after: ttl,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code: string = Math.floor(100000 + Math.random() * 900000).toString();

    const EXPIRES_IN = 300;
    const RETRY_AFTER = 60;

    const { last9: fixed_phone } = normalizeUzPhone(phone);

    const message_id =
      Array.from({ length: 3 }, () =>
        String.fromCharCode(97 + Math.floor(Math.random() * 26)),
      ).join('') +
      Math.floor(Math.random() * 1000000000)
        .toString()
        .padStart(9, '0');

    await this.redisService.set(`${this.REDIS_PREFIX[type]}:${phone}`, code, EXPIRES_IN);

    const data_to_send = {
      recipient: Number(fixed_phone),
      'message-id': message_id,
      sms: {
        originator: process.env.SMS_ORIGINATOR,
        content: {
          text: `Tasdiqlash kodi: ${code}\nKod faqat siz uchun. Uni boshqalarga bermang.`,
        },
      },
    };
    const sms_creadentials = {
      username: process.env.SMS_USERNAME || '',
      password: process.env.SMS_PASSWORD || '',
    };

    if (process.env.NODE_ENV !== 'development' && process.env.SMS_API_URL) {
      await axios.post(
        process.env.SMS_API_URL,
        {
          messages: data_to_send,
        },
        {
          auth: sms_creadentials,
        },
      );
    }

    // Set rate limit only after successful sending (or skipping in dev)
    await this.redisService.set(rateLimitKey, '1', RETRY_AFTER);

    const expiresAt = new Date(Date.now() + EXPIRES_IN * 1000).toISOString();

    const res: SendCodeResponseDto = {
      message: 'Verification code sent successfully',
      expires_in: EXPIRES_IN,
      expires_at: expiresAt,
      retry_after: RETRY_AFTER,
    };

    if (process.env.NODE_ENV !== 'production') {
      res.code = code;
    }

    return res;
  }

  async sendVerificationCode(dto: SmsDto): Promise<SendCodeResponseDto> {
    const existingAdmin: Admin | undefined = await this.adminsService.findByPhoneNumber(
      dto.phone_number,
    );

    if (!existingAdmin) {
      throw new NotFoundException({
        message: 'Admin not found. Please contact super admin.',
        location: 'admin_not_found',
      });
    }

    if (existingAdmin.status !== 'Pending') {
      throw new ConflictException({
        message: 'Admin already registered or not allowed to verify.',
        location: 'already_registered',
      });
    }

    return await this.sendCode(dto.phone_number, 'verify');
  }

  async verifyCode(dto: VerifyDto): Promise<{ message: string }> {
    const storedCode: string | null = await this.redisService.get(
      `${this.REDIS_PREFIX.verify}:${dto.phone_number}`,
    );

    if (!storedCode || storedCode !== dto.code) {
      throw new BadRequestException({
        message: 'Invalid verification code',
        location: 'invalid_code',
      });
    }

    await this.adminsService.markPhoneVerified(dto.phone_number);
    await this.redisService.del(`${this.REDIS_PREFIX.verify}:${dto.phone_number}`);

    return { message: 'Phone number verified successfully' };
  }

  async completeRegistration(dto: RegisterDto): Promise<{ access_token: string }> {
    const admin: Admin | undefined = await this.adminsService.findByPhoneNumber(dto.phone_number);

    if (dto.password !== dto.confirm_password) {
      throw new BadRequestException({
        message: 'Passwords do not match',
        location: 'confirm_password',
      });
    }

    if (!admin) {
      throw new NotFoundException({
        message: 'Admin not found. Please contact super admin.',
        location: 'admin_not_found',
      });
    }

    if (admin.status !== 'Pending') {
      throw new ConflictException({
        message: 'Admin already completed registration',
        location: 'already_registered',
      });
    }

    if (!admin.phone_verified) {
      throw new BadRequestException({
        message: 'Phone number not verified',
        location: 'phone_not_verified',
      });
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    await this.adminsService.updateAdminByPhone(dto.phone_number, {
      password: hashedPassword,
      status: 'Open',
    });

    const payload = { id: admin.id, phone_number: admin.phone_number, roles: [] };
    const token = this.jwtService.sign(payload);

    await this.setAdminSession(admin.id, token);

    return {
      access_token: token,
    };
  }

  async login(loginDto: LoginDto): Promise<{ access_token: string }> {
    const admin: Admin | undefined = await this.adminsService.findByPhoneNumber(
      loginDto.phone_number,
    );

    if (admin && admin?.status === 'Pending') {
      throw new ForbiddenException({
        message: 'Registration incomplete. Please finish registration.',
        location: 'incomplete_registration',
      });
    }

    this.adminsService.checkAdminAccessControl(admin, { requireVerified: true });

    const isPasswordValid =
      admin && (await bcrypt.compare(loginDto.password, admin?.password || ''));
    if (!admin || !isPasswordValid) {
      throw new UnauthorizedException({
        message: 'Invalid credentials',
        location: 'invalid_login',
      });
    }

    const payload = { id: admin.id, phone_number: admin.phone_number, roles: [] };
    const token = this.jwtService.sign(payload);

    await this.setAdminSession(admin.id, token);

    return {
      access_token: token,
    };
  }

  async logout(adminId: string, token: string): Promise<{ message: string }> {
    const sessionKey = `session:admin:${adminId}`;

    const exists: string | null = await this.redisService.get(sessionKey);

    if (!exists) {
      throw new UnauthorizedException({
        message: 'Session not found',
        location: 'no_active_session',
      });
    }

    await this.redisService.del(sessionKey);

    const blacklistKey = `blacklist:token:${token}`;
    await this.redisService.set(blacklistKey, 'blacklisted', 60 * 60 * 24 * 7);

    return { message: 'Logged out successfully' };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<SendCodeResponseDto> {
    const admin: Admin | undefined = await this.adminsService.findByPhoneNumber(dto.phone_number);

    this.adminsService.checkAdminAccessControl(admin, { requireVerified: true });

    return await this.sendCode(dto.phone_number, 'reset');
  }

  async verifyForgotPasswordOtp(
    dto: VerifyForgotPasswordOtpDto,
  ): Promise<{ message: string; reset_token: string }> {
    const redisKey = `${this.REDIS_PREFIX.reset}:${dto.phone_number}`;
    const storedCode: string | null = await this.redisService.get(redisKey);

    if (!storedCode || storedCode !== dto.code) {
      throw new BadRequestException({
        message: 'Invalid or expired code',
        location: 'invalid_code',
      });
    }

    // Generate a secure random token (32 bytes = 64 hex characters)
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Store the token in Redis with 10-minute TTL (600 seconds)
    const tokenKey = `${this.FORGOT_PASSWORD_TOKEN_PREFIX}${dto.phone_number}`;
    await this.redisService.set(tokenKey, resetToken, 600);

    // Delete the OTP to prevent reuse
    await this.redisService.del(redisKey);

    return {
      message: 'OTP verified successfully',
      reset_token: resetToken,
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const tokenKey = `${this.FORGOT_PASSWORD_TOKEN_PREFIX}${dto.phone_number}`;
    const storedToken: string | null = await this.redisService.get(tokenKey);

    if (!storedToken || storedToken !== dto.reset_token) {
      throw new BadRequestException({
        message: 'Invalid or expired reset token',
        location: 'invalid_reset_token',
      });
    }

    if (dto.new_password !== dto.confirm_new_password) {
      throw new BadRequestException({
        message: 'Passwords do not match',
        location: 'confirm_password',
      });
    }

    const hashed = await bcrypt.hash(dto.new_password, 10);
    await this.knex('admins')
      .where({ phone_number: dto.phone_number })
      .update({ password: hashed, updated_at: new Date() });

    // Delete the token after successful password reset
    await this.redisService.del(tokenKey);

    return { message: '✅ Password reset successfully' };
  }

  private async setAdminSession(adminId: string, token: string): Promise<void> {
    await this.redisService.set(`session:admin:${adminId}`, token, 60 * 60 * 24 * 7);
  }
}
