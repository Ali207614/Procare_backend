import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyDto } from './dto/verify.dto';
import { SmsDto } from './dto/sms.dto';
import { RedisService } from 'src/common/redis/redis.service';
import { Knex } from 'knex';
import { InjectKnex } from 'nestjs-knex';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { AdminsService } from 'src/admins/admins.service';
import { Admin } from 'src/common/types/admin.interface';

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

  async sendVerificationCode(dto: SmsDto): Promise<{ message: string; code: string }> {
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
        location: 'invalid_status',
      });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    console.log('Verification code:', code);

    await this.redisService.set(`verify:${dto.phone_number}`, code, 300); // 5 min TTL

    // TODO: await this.smsService.send(dto.phone_number, code);

    return { message: 'Verification code sent successfully', code };
  }

  async verifyCode(dto: VerifyDto): Promise<{ message: string }> {
    const storedCode: string | null = await this.redisService.get(`verify:${dto.phone_number}`);

    if (!storedCode || storedCode !== dto.code) {
      throw new BadRequestException({
        message: 'Invalid verification code',
        location: 'invalid_code',
      });
    }

    await this.adminsService.markPhoneVerified(dto.phone_number);
    await this.redisService.del(`verify:${dto.phone_number}`);

    return { message: 'Phone number verified successfully' };
  }

  async completeRegistration(dto: RegisterDto): Promise<{ access_token: string }> {
    const admin: Admin | undefined = await this.adminsService.findByPhoneNumber(dto.phone_number);

    if (dto.password !== dto.confirm_password) {
      throw new BadRequestException({
        message: 'Passwords do not match',
        location: 'confirmPassword',
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

    console.log(admin);

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

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string; code: string }> {
    const admin: Admin | undefined = await this.adminsService.findByPhoneNumber(dto.phone_number);

    this.adminsService.checkAdminAccessControl(admin, { requireVerified: true });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await this.redisService.set(`${this.RESET_PREFIX}${dto.phone_number}`, code, 300); // 5 min

    // TODO: await this.smsService.send(dto.phone_number, `🔐 Reset code: ${code}`);
    console.log(`Reset code: ${code}`);

    return { message: 'Reset code sent successfully', code: code };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const redisKey = `${this.RESET_PREFIX}${dto.phone_number}`;
    const code: string | null = await this.redisService.get(redisKey);

    if (!code || code !== dto.code) {
      throw new BadRequestException({
        message: 'Invalid or expired code',
        location: 'invalid_code',
      });
    }

    if (dto.new_password !== dto.confirm_new_password) {
      throw new BadRequestException({
        message: 'Passwords do not match',
        location: 'confirm_new_password',
      });
    }

    const hashed = await bcrypt.hash(dto.new_password, 10);
    await this.knex('admins')
      .where({ phone_number: dto.phone_number })
      .update({ password: hashed, updated_at: new Date() });

    await this.redisService.del(redisKey);

    return { message: '✅ Password reset successfully' };
  }

  private async setAdminSession(adminId: string, token: string): Promise<void> {
    await this.redisService.set(`session:admin:${adminId}`, token, 60 * 60 * 24 * 7);
  }
}
