import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly baseUrl: string;

  constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN is not defined');
    }
    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  async sendMessage(chatId: string | number, text: string): Promise<AxiosResponse<any>> {
    try {
      return axios.post(`${this.baseUrl}/sendMessage`, {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      });
    } catch (err: any) {
      if (err.response?.status === 429) {
        const retryAfter = err.response.data.parameters?.retry_after || 5;
        this.logger.warn(`⚠️ FloodWait: sleeping ${retryAfter}s`);
        await new Promise((res) => setTimeout(res, retryAfter * 1000));
        return this.sendMessage(chatId, text);
      }

      this.logger.error(`❌ Telegram sendMessage error (chatId=${chatId}): ${err.message}`);
      throw err;
    }
  }

  async sendPhoto(
    chatId: string | number,
    photoUrl: string,
    caption?: string,
  ): Promise<AxiosResponse<any>> {
    return axios.post(`${this.baseUrl}/sendPhoto`, {
      chat_id: chatId,
      photo: photoUrl,
      caption,
      parse_mode: 'HTML',
    });
  }

  async sendDocument(
    chatId: string | number,
    fileUrl: string,
    caption?: string,
  ): Promise<AxiosResponse<any>> {
    return axios.post(`${this.baseUrl}/sendDocument`, {
      chat_id: chatId,
      document: fileUrl,
      caption,
      parse_mode: 'HTML',
    });
  }
}
