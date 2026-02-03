import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosResponse } from 'axios';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly baseUrl: string;
  private readonly isEnabled: boolean;

  constructor(private configService: ConfigService) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    this.isEnabled = !!token;

    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN is not defined. Telegram notifications disabled.');
      this.baseUrl = '';
      return;
    }

    this.baseUrl = `https://api.telegram.org/bot${token}`;
    this.logger.log('TelegramService initialized successfully');
  }

  async sendMessage(chatId: string | number, text: string): Promise<AxiosResponse<unknown> | null> {
    if (!this.isEnabled) {
      this.logger.warn('Telegram is disabled. Message not sent.');
      return null;
    }

    try {
      return await axios.post(`${this.baseUrl}/sendMessage`, {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      });
    } catch (err: unknown) {
      if (err.response?.status === 429) {
        const retryAfter = err.response.data.parameters?.retry_after || 5;
        this.logger.warn(`⚠️ FloodWait: sleeping ${retryAfter}s`);
        await new Promise((res) => setTimeout(res, retryAfter * 1000));
        return this.sendMessage(chatId, text);
      }

      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`❌ Telegram sendMessage error (chatId=${chatId}): ${errorMessage}`);
      return null; // Don't throw error, just log it
    }
  }

  async sendPhoto(
    chatId: string | number,
    photoUrl: string,
    caption?: string,
  ): Promise<AxiosResponse<unknown> | null> {
    if (!this.isEnabled) {
      this.logger.warn('Telegram is disabled. Photo not sent.');
      return null;
    }

    try {
      return await axios.post(`${this.baseUrl}/sendPhoto`, {
        chat_id: chatId,
        photo: photoUrl,
        caption,
        parse_mode: 'HTML',
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`❌ Telegram sendPhoto error: ${errorMessage}`);
      return null;
    }
  }

  async sendDocument(
    chatId: string | number,
    fileUrl: string,
    caption?: string,
  ): Promise<AxiosResponse<unknown> | null> {
    if (!this.isEnabled) {
      this.logger.warn('Telegram is disabled. Document not sent.');
      return null;
    }

    try {
      return await axios.post(`${this.baseUrl}/sendDocument`, {
        chat_id: chatId,
        document: fileUrl,
        caption,
        parse_mode: 'HTML',
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`❌ Telegram sendDocument error: ${errorMessage}`);
      return null;
    }
  }
}
