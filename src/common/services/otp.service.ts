import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Knex } from 'knex';
import { InjectKnex } from 'nestjs-knex';
import { v4 as uuidv4 } from 'uuid';
import { SmsService } from './sms.service';

export interface OtpRecord {
  id: string;
  phone_number: string;
  code: string;
  type: 'registration' | 'login' | 'password_reset' | 'phone_verification';
  language: 'uz' | 'ru' | 'en';
  attempts: number;
  verified: boolean;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface GenerateOtpResult {
  success: boolean;
  otpId: string;
  expiresAt: Date;
  message: string;
  error?: string;
}

export interface VerifyOtpResult {
  success: boolean;
  message: string;
  remainingAttempts?: number;
  error?: string;
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly codeLength: number;
  private readonly expiryMinutes: number;
  private readonly maxAttempts: number;
  private readonly cooldownMinutes: number;

  constructor(
    @InjectKnex() private readonly knex: Knex,
    private readonly smsService: SmsService,
    private readonly configService: ConfigService,
  ) {
    this.codeLength = this.configService.get<number>('OTP_CODE_LENGTH') || 6;
    this.expiryMinutes = this.configService.get<number>('OTP_EXPIRY_MINUTES') || 5;
    this.maxAttempts = this.configService.get<number>('OTP_MAX_ATTEMPTS') || 3;
    this.cooldownMinutes = this.configService.get<number>('OTP_COOLDOWN_MINUTES') || 1;
  }

  /**
   * OTP kodi generatsiya qilish va SMS yuborish
   */
  async generateAndSendOtp(
    phoneNumber: string,
    type: OtpRecord['type'] = 'registration',
    language: OtpRecord['language'] = 'uz',
  ): Promise<GenerateOtpResult> {
    try {
      // Telefon raqamini formatlash
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      // Cooldown tekshirish
      const recentOtp = await this.checkCooldown(formattedPhone, type);
      if (recentOtp) {
        const remainingTime = Math.ceil(
          (recentOtp.created_at.getTime() + this.cooldownMinutes * 60 * 1000 - Date.now()) / 1000,
        );
        return {
          success: false,
          otpId: '',
          expiresAt: new Date(),
          message: `Iltimos ${Math.ceil(remainingTime / 60)} daqiqa kuting`,
          error: 'COOLDOWN_ACTIVE',
        };
      }

      // Avvalgi active OTP larni bekor qilish
      await this.deactivateExistingOtps(formattedPhone, type);

      // Yangi OTP kodi generatsiya qilish
      const code = this.generateCode();
      const otpId = uuidv4();
      const expiresAt = new Date(Date.now() + this.expiryMinutes * 60 * 1000);

      // Database ga saqlash
      await this.knex<OtpRecord>('otp_verifications').insert({
        id: otpId,
        phone_number: formattedPhone,
        code: code,
        type: type,
        language: language,
        attempts: 0,
        verified: false,
        expires_at: expiresAt,
        created_at: new Date(),
        updated_at: new Date(),
      });

      // SMS yuborish
      const smsResult = await this.smsService.sendOtpSms(formattedPhone, code, language);

      if (!smsResult.success) {
        // SMS yuborishda xatolik bo'lsa, OTP ni o'chirish
        await this.knex('otp_verifications').where({ id: otpId }).del();

        return {
          success: false,
          otpId: '',
          expiresAt: new Date(),
          message: 'SMS yuborishda xatolik yuz berdi',
          error: smsResult.error,
        };
      }

      this.logger.log(`OTP generated for ${formattedPhone}`, {
        otpId,
        type,
        expiresAt,
      });

      return {
        success: true,
        otpId,
        expiresAt,
        message: `Tasdiqlash kodi ${formattedPhone} raqamiga yuborildi`,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error('Failed to generate OTP', {
        phoneNumber,
        type,
        error: errorMessage,
        stack: errorStack,
      });

      return {
        success: false,
        otpId: '',
        expiresAt: new Date(),
        message: 'Tasdiqlash kodi yuborishda xatolik',
        error: errorMessage,
      };
    }
  }

  /**
   * OTP kodi tekshirish
   */
  async verifyOtp(
    phoneNumber: string,
    code: string,
    type: OtpRecord['type'],
  ): Promise<VerifyOtpResult> {
    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      // Active OTP ni topish
      const otpRecord = await this.knex<OtpRecord>('otp_verifications')
        .where({
          phone_number: formattedPhone,
          type: type,
          verified: false,
        })
        .andWhere('expires_at', '>', new Date())
        .orderBy('created_at', 'desc')
        .first();

      if (!otpRecord) {
        return {
          success: false,
          message: 'Tasdiqlash kodi topilmadi yoki muddati tugagan',
          error: 'OTP_NOT_FOUND',
        };
      }

      // Urinishlar sonini tekshirish
      if (otpRecord.attempts >= this.maxAttempts) {
        await this.deactivateOtp(otpRecord.id);
        return {
          success: false,
          message: 'Maksimal urinishlar soni oshib ketdi',
          error: 'MAX_ATTEMPTS_EXCEEDED',
        };
      }

      // Urinishlar sonini oshirish
      await this.knex('otp_verifications')
        .where({ id: otpRecord.id })
        .update({
          attempts: otpRecord.attempts + 1,
          updated_at: new Date(),
        });

      // Kodni tekshirish
      if (otpRecord.code !== code) {
        const remainingAttempts = this.maxAttempts - (otpRecord.attempts + 1);

        if (remainingAttempts <= 0) {
          await this.deactivateOtp(otpRecord.id);
          return {
            success: false,
            message: "Noto'g'ri kod. Maksimal urinishlar tugadi.",
            error: 'INVALID_CODE_MAX_ATTEMPTS',
          };
        }

        return {
          success: false,
          message: `Noto'g'ri kod. ${remainingAttempts} ta urinish qoldi`,
          remainingAttempts,
          error: 'INVALID_CODE',
        };
      }

      // Muvaffaqiyatli tekshirish
      await this.knex('otp_verifications').where({ id: otpRecord.id }).update({
        verified: true,
        updated_at: new Date(),
      });

      this.logger.log(`OTP verified successfully for ${formattedPhone}`, {
        otpId: otpRecord.id,
        type: type,
      });

      return {
        success: true,
        message: "Tasdiqlash kodi to'g'ri",
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error('Failed to verify OTP', {
        phoneNumber,
        type,
        error: errorMessage,
        stack: errorStack,
      });

      return {
        success: false,
        message: 'Tasdiqlash kodini tekshirishda xatolik',
        error: errorMessage,
      };
    }
  }

  /**
   * OTP ni qayta yuborish
   */
  async resendOtp(
    phoneNumber: string,
    type: OtpRecord['type'],
    language: OtpRecord['language'] = 'uz',
  ): Promise<GenerateOtpResult> {
    const formattedPhone = this.formatPhoneNumber(phoneNumber);

    // Avvalgi OTP larni bekor qilish
    await this.deactivateExistingOtps(formattedPhone, type);

    // Yangi OTP yuborish
    return this.generateAndSendOtp(formattedPhone, type, language);
  }

  /**
   * Phone raqam uchun verified OTP borligini tekshirish
   */
  async hasVerifiedOtp(
    phoneNumber: string,
    type: OtpRecord['type'],
    withinMinutes = 10,
  ): Promise<boolean> {
    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    const since = new Date(Date.now() - withinMinutes * 60 * 1000);

    const verifiedOtp = await this.knex<OtpRecord>('otp_verifications')
      .where({
        phone_number: formattedPhone,
        type: type,
        verified: true,
      })
      .andWhere('created_at', '>=', since)
      .first();

    return !!verifiedOtp;
  }

  /**
   * Eski OTP larni tozalash
   */
  async cleanupExpiredOtps(): Promise<void> {
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 soat oldin

    const deletedCount = await this.knex('otp_verifications')
      .where('created_at', '<', cutoffDate)
      .del();

    if (deletedCount > 0) {
      this.logger.log(`Cleaned up ${deletedCount} expired OTP records`);
    }
  }

  /**
   * Cooldown tekshirish
   */
  private async checkCooldown(
    phoneNumber: string,
    type: OtpRecord['type'],
  ): Promise<OtpRecord | null> {
    const cooldownTime = new Date(Date.now() - this.cooldownMinutes * 60 * 1000);

    return (
      (await this.knex<OtpRecord>('otp_verifications')
        .where({
          phone_number: phoneNumber,
          type: type,
        })
        .andWhere('created_at', '>', cooldownTime)
        .orderBy('created_at', 'desc')
        .first()) || null
    );
  }

  /**
   * Mavjud active OTP larni bekor qilish
   */
  private async deactivateExistingOtps(
    phoneNumber: string,
    type: OtpRecord['type'],
  ): Promise<void> {
    await this.knex('otp_verifications')
      .where({
        phone_number: phoneNumber,
        type: type,
        verified: false,
      })
      .update({
        verified: true, // Bekor qilish uchun verified true qilamiz
        updated_at: new Date(),
      });
  }

  /**
   * Bitta OTP ni bekor qilish
   */
  private async deactivateOtp(otpId: string): Promise<void> {
    await this.knex('otp_verifications').where({ id: otpId }).update({
      verified: true,
      updated_at: new Date(),
    });
  }

  /**
   * Telefon raqamini formatlash
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // +998901234567 formatiga keltirish
    let cleaned = phoneNumber.replace(/[^\d]/g, '');

    if (cleaned.startsWith('998')) {
      cleaned = `+${cleaned}`;
    } else if (cleaned.length === 9) {
      cleaned = `+998${cleaned}`;
    } else {
      cleaned = `+998${cleaned.slice(-9)}`;
    }

    return cleaned;
  }

  /**
   * Random kod generatsiya qilish
   */
  private generateCode(): string {
    if (process.env.NODE_ENV === 'test') {
      return '123456'; // Test environment uchun fixed kod
    }

    const min = Math.pow(10, this.codeLength - 1);
    const max = Math.pow(10, this.codeLength) - 1;
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  }
}
