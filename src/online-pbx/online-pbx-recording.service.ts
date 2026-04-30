import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { LoggerService } from 'src/common/logger/logger.service';

interface OnlinePbxToken {
  keyId: string;
  key: string;
}

interface OnlinePbxAuthResponse {
  data?: {
    key_id?: string;
    keyId?: string;
    key?: string;
    token?: string;
  };
  key_id?: string;
  keyId?: string;
  key?: string;
  token?: string;
}

interface OnlinePbxDownloadResponse {
  data?: unknown;
  message?: string;
  error_code?: string;
  errorCode?: string;
  isNotAuth?: boolean;
}

@Injectable()
export class OnlinePbxRecordingService {
  private token: OnlinePbxToken | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  async getFreshDownloadUrl(uuid: string): Promise<string | null> {
    if (!uuid) return null;

    try {
      return await this.requestDownloadUrl(uuid);
    } catch (error) {
      if (this.isAuthError(error)) {
        this.token = null;
        try {
          return await this.requestDownloadUrl(uuid);
        } catch (retryError) {
          this.logError(uuid, retryError);
          return null;
        }
      }

      this.logError(uuid, error);
      return null;
    }
  }

  private async requestDownloadUrl(uuid: string): Promise<string | null> {
    const authHeader = await this.getAuthHeader();
    const body = new URLSearchParams({ uuid, download: '1' });
    const response = await axios.post<OnlinePbxDownloadResponse>(
      `${this.baseUrl}/mongo_history/search.json`,
      body,
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-pbx-authentication': authHeader,
        },
        timeout: 30000,
      },
    );
    const data = this.normalizeResponse<OnlinePbxDownloadResponse>(response.data);

    if (data?.isNotAuth || this.isOnlinePbxAuthError(data)) {
      this.token = null;
      throw new Error(data.message || data.error_code || data.errorCode || 'ONLINEPBX_AUTH_ERROR');
    }

    return typeof data?.data === 'string' ? data.data : null;
  }

  private async getAuthHeader(): Promise<string> {
    if (!this.token) {
      this.token = await this.login();
    }

    return `${this.token.keyId}:${this.token.key}`;
  }

  private async login(): Promise<OnlinePbxToken> {
    const authKey = this.authKey;
    if (!authKey) {
      throw new Error('PBX_AUTH_KEY is not configured');
    }

    const body = new URLSearchParams({ auth_key: authKey });
    const response = await axios.post<OnlinePbxAuthResponse>(`${this.baseUrl}/auth.json`, body, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 30000,
    });
    const data = this.normalizeResponse<OnlinePbxAuthResponse>(response.data);
    const keyId = data?.data?.key_id || data?.key_id || data?.data?.keyId || data?.keyId;
    const key = data?.data?.key || data?.key || data?.data?.token || data?.token;

    if (!keyId || !key) {
      throw new Error('OnlinePBX auth failed: key_id/key not found');
    }

    return { keyId, key };
  }

  private normalizeResponse<T>(data: T | string): T {
    if (typeof data !== 'string') return data;

    try {
      return JSON.parse(data) as T;
    } catch {
      return data as T;
    }
  }

  private isAuthError(error: unknown): boolean {
    if (axios.isAxiosError(error)) {
      return this.isOnlinePbxAuthError(error.response?.data as OnlinePbxDownloadResponse);
    }

    if (error instanceof Error) {
      return error.message === 'ONLINEPBX_AUTH_ERROR' || error.message === 'KEY_IS_EXPIRED';
    }

    return false;
  }

  private isOnlinePbxAuthError(data?: OnlinePbxDownloadResponse): boolean {
    if (!data) return false;

    const code = data.error_code || data.errorCode || data.message || '';
    return data.isNotAuth === true || String(code).includes('AUTH') || code === 'KEY_IS_EXPIRED';
  }

  private logError(uuid: string, error: unknown): void {
    if (axios.isAxiosError(error)) {
      this.logger.warn(
        `[OnlinePBX] Failed to refresh recording URL for ${uuid}: ${JSON.stringify(
          error.response?.data || error.message,
        )}`,
      );
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    this.logger.warn(`[OnlinePBX] Failed to refresh recording URL for ${uuid}: ${message}`);
  }

  private get baseUrl(): string {
    const host =
      this.config.get<string>('PBX_API_HOST') ||
      this.config.get<string>('ONLINEPBX_API_HOST') ||
      'https://api2.onlinepbx.ru';
    const domain = this.config.get<string>('PBX_DOMAIN');

    if (!domain) {
      throw new Error('PBX_DOMAIN is not configured');
    }

    return `${host.replace(/\/+$/, '')}/${domain.replace(/^\/+|\/+$/g, '')}`;
  }

  private get authKey(): string {
    return (
      this.config.get<string>('PBX_AUTH_KEY') || this.config.get<string>('ONLINEPBX_API_KEY') || ''
    );
  }
}
