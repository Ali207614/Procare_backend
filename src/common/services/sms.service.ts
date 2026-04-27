import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface SmsMessage {
  recipient: string;
  text: string;
  messageId?: string;
}

export interface SmsResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly apiUrl: string;
  private readonly username: string;
  private readonly password: string;
  private readonly originator: string;
  private readonly nodeEnv: string;

  constructor(private readonly configService: ConfigService) {
    const configuredApiUrl = this.configService.get<string>('SMS_API_URL');
    const configuredBaseUrl =
      this.configService.get<string>('SMS_BASE_URL') || 'https://send.smsxabar.uz';

    this.apiUrl = configuredApiUrl || `${configuredBaseUrl.replace(/\/+$/, '')}/broker-api/send`;
    this.username = this.configService.get<string>('SMS_USERNAME') || '';
    this.password = this.configService.get<string>('SMS_PASSWORD') || '';
    this.originator = this.configService.get<string>('SMS_ORIGINATOR') || 'PROBOX';
    this.nodeEnv =
      this.configService.get<string>('NODE_ENV') || process.env.NODE_ENV || 'development';
  }

  /**
   * SMS yuborish
   */
  async sendSms(message: SmsMessage): Promise<SmsResponse> {
    try {
      const payload = {
        messages: {
          recipient: this.formatPhoneNumber(message.recipient),
          'message-id': message.messageId || this.generateMessageId(),
          sms: {
            originator: this.originator,
            content: {
              text: message.text,
            },
          },
        },
      };

      if (this.nodeEnv === 'development' || this.nodeEnv === 'test') {
        this.logger.log(`SMS skipped in ${this.nodeEnv} mode`, {
          recipient: payload.messages.recipient,
          messageId: payload.messages['message-id'],
        });

        return {
          success: true,
          messageId: payload.messages['message-id'],
        };
      }

      const response = await axios.post(this.apiUrl, payload, {
        auth: {
          username: this.username,
          password: this.password,
        },
        timeout: 10000, // 10 seconds timeout
      });

      this.logger.log(`SMS sent successfully to ${message.recipient}`, {
        messageId: payload.messages['message-id'],
        status: response.status,
      });

      return {
        success: true,
        messageId: payload.messages['message-id'],
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'SMS sending failed';
      const errorStack = error instanceof Error ? error.stack : undefined;
      const responseData =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: unknown } }).response?.data
          : undefined;

      this.logger.error(`Failed to send SMS to ${message.recipient}`, {
        error: errorMessage,
        stack: errorStack,
        response: responseData,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * OTP SMS yuborish
   */
  async sendOtpSms(phoneNumber: string, code: string, language = 'uz'): Promise<SmsResponse> {
    const templates = {
      uz: `ProBox tasdiqlash kodi: ${code}\n\nBu kodni hech kimga bermang!\nMuddati: 5 daqiqa`,
      ru: `Код подтверждения ProBox: ${code}\n\nНе сообщайте этот код никому!\nСрок действия: 5 минут`,
      en: `ProBox verification code: ${code}\n\nDon't share this code with anyone!\nExpires in: 5 minutes`,
    };

    const text = templates[language as keyof typeof templates] || templates.uz;

    return this.sendSms({
      recipient: phoneNumber,
      text: text,
    });
  }

  /**
   * Welcome SMS yuborish
   */
  async sendWelcomeSms(
    phoneNumber: string,
    firstName: string,
    language = 'uz',
  ): Promise<SmsResponse> {
    const templates = {
      uz: `Salom ${firstName}! 👋\n\nProBox xizmatiga xush kelibsiz! Sizning hisob qaydnomangiz muvaffaqiyatli yaratildi.\n\nBizning xizmatlarimizdan foydalanishingiz mumkin.`,
      ru: `Привет ${firstName}! 👋\n\nДобро пожаловать в ProBox! Ваша учетная запись успешно создана.\n\nВы можете начать пользоваться нашими услугами.`,
      en: `Hello ${firstName}! 👋\n\nWelcome to ProBox! Your account has been successfully created.\n\nYou can now start using our services.`,
    };

    const text = templates[language as keyof typeof templates] || templates.uz;

    return this.sendSms({
      recipient: phoneNumber,
      text: text,
      messageId: `welcome_${Date.now()}_${this.formatPhoneNumber(phoneNumber)}`,
    });
  }

  /**
   * Repair order status SMS yuborish
   */
  async sendRepairOrderStatusSms(
    phoneNumber: string,
    orderNumber: string,
    status: string,
    language = 'uz',
  ): Promise<SmsResponse> {
    const templates = {
      uz: {
        Open: `📱 Buyurtma #${orderNumber} qabul qilindi!\n\nTa'mirlash jarayoni tez orada boshlanadi. Holat o'zgarishi haqida xabar beramiz.`,
        InProgress: `🔧 Buyurtma #${orderNumber} ta'mirlanmoqda!\n\nMutaxassislarimiz qurilmangiz ustida ishlamoqda.`,
        Completed: `✅ Buyurtma #${orderNumber} tayyor!\n\nQurilmangizni olib ketishingiz mumkin. Ish vaqti: 9:00-18:00`,
        Closed: `📋 Buyurtma #${orderNumber} yopildi.\n\nXizmatimizdan foydalanganingiz uchun rahmat!`,
      },
      ru: {
        Open: `📱 Заказ #${orderNumber} принят!\n\nРемонт скоро начнется. Уведомим об изменении статуса.`,
        InProgress: `🔧 Заказ #${orderNumber} в ремонте!\n\nНаши специалисты работают над вашим устройством.`,
        Completed: `✅ Заказ #${orderNumber} готов!\n\nМожете забрать устройство. Время работы: 9:00-18:00`,
        Closed: `📋 Заказ #${orderNumber} закрыт.\n\nСпасибо за использование наших услуг!`,
      },
    };

    const statusTemplates = templates[language as keyof typeof templates] || templates.uz;
    const text =
      statusTemplates[status as keyof typeof statusTemplates] ||
      `Buyurtma #${orderNumber} holati o'zgartirildi: ${status}`;

    return this.sendSms({
      recipient: phoneNumber,
      text: text,
      messageId: `status_${orderNumber}_${Date.now()}`,
    });
  }

  /**
   * Telefon raqamini formatlash
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // +998901234567 -> 998901234567
    const cleaned = phoneNumber.replace(/[^\d]/g, '');
    return cleaned.startsWith('998') ? cleaned : `998${cleaned.slice(-9)}`;
  }

  /**
   * Unique message ID generatsiya qilish
   */
  private generateMessageId(): string {
    const prefix = Array.from({ length: 3 }, () =>
      String.fromCharCode(97 + Math.floor(Math.random() * 26)),
    ).join('');
    const suffix = Math.floor(Math.random() * 1000000000)
      .toString()
      .padStart(9, '0');

    return `${prefix}${suffix}`;
  }

  /**
   * SMS service ishlayotganini tekshirish
   */
  healthCheck(): boolean {
    try {
      // Test SMS jo'natmasdan, faqat credentials va endpoint ni tekshirish
      const credentials = Buffer.from(`${this.username}:${this.password}`).toString('base64');

      if (!this.username || !this.password || !credentials) {
        this.logger.warn('SMS credentials not configured properly');
        return false;
      }

      // Agar test environment bo'lsa, true qaytarish
      if (process.env.NODE_ENV === 'test') {
        return true;
      }

      return true;
    } catch (error: unknown) {
      this.logger.error('SMS health check failed', error);
      return false;
    }
  }
}
