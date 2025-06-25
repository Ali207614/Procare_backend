import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as https from 'https';
import { get } from 'lodash';
import { LoggerService } from 'src/common/logger/logger.service';
import { RedisService } from 'src/common/redis/redis.service';
import { executeOnce } from 'src/common/utils/hana.util';
import { loadSQL } from 'src/common/utils/sql-loader.util';

@Injectable()
export class SapService {
  private readonly api = process.env.SAP_API_URL;
  private readonly sessionKey = 'sap:session';
  private readonly schema = process.env.SAP_SCHEMA || 'PROBOX_PROD_3';
  private axiosInstance: AxiosInstance;

  constructor(
    private readonly redis: RedisService,
    private readonly logger: LoggerService,
  ) {
    this.axiosInstance = axios.create({
      baseURL: this.api,
      timeout: 30000,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    });
  }

  async auth(): Promise<{ status: boolean; message?: string }> {
    const loginPayload = {
      UserName: process.env.SAP_USER,
      Password: process.env.SAP_PASSWORD,
      CompanyDB: process.env.SAP_SCHEMA,
    };

    try {
      const { data, headers } = await this.axiosInstance.post('/Login', loginPayload);

      await this.redis.set(
        this.sessionKey,
        {
          Cookie: headers['set-cookie'] ?? [],
          SessionId: data?.SessionId ?? '',
        },
        1800,
      ); // TTL: 30min

      this.logger.log('✅ SAP login success');
      return { status: true };
    } catch (err) {
      const msg = get(err, 'response.data.error.message.value', 'SAP login failed');
      this.logger.error(`❌ SAP auth error: ${msg}`);
      return { status: false, message: msg };
    }
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const session = await this.redis.get<{ Cookie: string[]; SessionId: string }>(this.sessionKey);

    return {
      Cookie: session?.Cookie?.join('') || '',
      SessionId: session?.SessionId || '',
      'Content-Type': 'application/json',
    };
  }

  async checkBusinessPartnerByPhone(phone: string): Promise<string | null> {
    try {
      const sql = loadSQL('sap/queries/check-business-partner.sql');
      const finalQuery = sql.replace(/{{schema}}/g, this.schema);
      const result = await executeOnce(finalQuery, [phone]);

      return result?.[0]?.CardCode ?? null;
    } catch (err) {
      this.logger.error(`❌ SAP SQL checkBusinessPartner error`, err?.message || err);
      throw new ServiceUnavailableException('SAP SQL query failed');
    }
  }

  async createBusinessPartner(cardName: string, phone: string): Promise<string> {
    const cardCode = `C${Date.now()}`;

    const body = {
      CardCode: cardCode,
      CardName: cardName,
      Phone1: phone,
      CardType: 'C',
    };

    const exec = async () =>
      await this.axiosInstance.post('/BusinessPartners', body, {
        headers: await this.getAuthHeaders(),
      });

    try {
      const { data } = await exec();
      return data.CardCode;
    } catch (err) {
      if (get(err, 'response.status') === 401) {
        this.logger.warn('🔁 SAP session expired. Re-authenticating...');
        const login = await this.auth();
        if (login.status) {
          const { data } = await exec();
          return data.CardCode;
        }
        throw new ServiceUnavailableException(login.message || 'SAP auth failed');
      }

      const msg = get(err, 'response.data.error.message.value', 'BP creation failed');
      this.logger.error(`❌ SAP createBusinessPartner error: ${msg}`);
      throw new ServiceUnavailableException(msg);
    }
  }

  async checkOrCreateBusinessPartner(input: { cardName: string; phone: string }): Promise<string> {
    const existing = await this.checkBusinessPartnerByPhone(input.phone);
    if (existing) return existing;

    return await this.createBusinessPartner(input.cardName, input.phone);
  }

  async createRentalOrder(cardCode: string, itemCode: string, startDate: string): Promise<string> {
    const body = {
      CardCode: cardCode,
      ItemCode: itemCode,
      StartDate: startDate,
    };

    const exec = async () =>
      await this.axiosInstance.post('/Orders', body, {
        headers: await this.getAuthHeaders(),
      });

    try {
      const { data } = await exec();
      return data?.orderId;
    } catch (err) {
      if (get(err, 'response.status') === 401) {
        this.logger.warn('🔁 SAP session expired. Re-authenticating...');
        const login = await this.auth();
        if (login.status) {
          const { data } = await exec();
          return data?.orderId;
        }
        throw new ServiceUnavailableException(login.message || 'SAP auth failed');
      }

      const msg = get(err, 'response.data.error.message.value', 'Rental order creation failed');
      this.logger.error(`❌ SAP createRentalOrder error: ${msg}`);
      throw new ServiceUnavailableException(msg);
    }
  }

  async cancelRentalOrder(orderId: string): Promise<void> {
    const exec = async () =>
      await this.axiosInstance.post(`/Orders/${orderId}/cancel`, null, {
        headers: await this.getAuthHeaders(),
      });

    try {
      await exec();
    } catch (err) {
      if (get(err, 'response.status') === 401) {
        this.logger.warn('🔁 SAP session expired. Re-authenticating...');
        const login = await this.auth();
        if (login.status) {
          await exec();
          return;
        }
        throw new ServiceUnavailableException(login.message || 'SAP auth failed');
      }

      const msg = get(err, 'response.data.error.message.value', 'Cancel order failed');
      this.logger.error(`❌ SAP cancelRentalOrder error: ${msg}`);
      throw new ServiceUnavailableException(msg);
    }
  }
}
