import { Injectable } from '@nestjs/common';
import { LoggerService } from 'src/common/logger/logger.service';
import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as https from 'https';
import { User } from 'src/common/types/user.interface';

interface OnlinePbxWebhookPayload {
  uuid: string;
  caller?: string;
  callee?: string;
  direction?: string;
  event?: string;
  call_duration?: string | number;
  dialog_duration?: string | number;
  hangup_cause?: string;
  download_url?: string;
}

interface PhoneCall {
  id: string;
  uuid: string;
  caller: string | null;
  callee: string | null;
  direction: string | null;
  event: string | null;
  call_duration: number | null;
  dialog_duration: number | null;
  hangup_cause: string | null;
  download_url: string | null;
  user_id: string | null;
  repair_order_id: string | null;
  created_at: string;
  updated_at: string;
}

import { RepairOrdersService } from 'src/repair-orders/repair-orders.service';

@Injectable()
export class OnlinePbxService {
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;

  constructor(
    private readonly logger: LoggerService,
    private readonly config: ConfigService,
    @InjectKnex() private readonly knex: Knex,
    private readonly repairOrderService: RepairOrdersService,
  ) {
    // We use https as a default to ensure secure communication.
    // In Node.js, the implementation for http and https is handled by axios automatically
    // based on the URL prefix you provide.
    this.apiUrl = this.config.get<string>('ONLINEPBX_API_URL') || 'https://api.onlinepbx.ru/v1';
    this.apiKey = this.config.get<string>('ONLINEPBX_API_KEY') || '';
    this.apiSecret = this.config.get<string>('ONLINEPBX_API_SECRET') || '';
  }

  /**
   * Generic method to communicate with OnlinePBX API over HTTPS.
   * @param endpoint - The API endpoint (e.g., /callback/originate)
   * @param data - The payload to send
   */
  async callApi(endpoint: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    try {
      this.logger.log(`[OnlinePBX API] Sending request to ${this.apiUrl}${endpoint}`);

      // We explicitly use an https agent if we need to allow SSL in environments
      // where certificates might not be fully verifiable (though usually not recommended for production)
      const httpsAgent = new https.Agent({
        rejectUnauthorized: true, // Set to false ONLY if you have self-signed certificate issues in dev
      });

      const response = await axios.post<Record<string, unknown>>(
        `${this.apiUrl}${endpoint}`,
        data,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': this.apiKey, // Assuming OnlinePBX uses these headers
          },
          httpsAgent, // This ensures SSL is used and configured properly
        },
      );

      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        this.logger.error(
          `[OnlinePBX API] Axios Error: ${error.message}`,
          error.response?.data ? JSON.stringify(error.response.data) : undefined,
        );
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(`[OnlinePBX API] Unexpected Error: ${errorMessage}`);
      }
      throw error;
    }
  }

  /**
   * Helper to format phone number to DB standard +998XXXXXXXXX
   * Handles 3-digit OnlinePBX tokens as special cases.
   */
  private formatPhone(phone: string | undefined): string | null {
    if (!phone || typeof phone !== 'string') return null;

    // Remove any non-digit characters if present
    const digits = phone.replace(/\D/g, '');

    // 3-digit tokens/extensions should be kept as is
    if (digits.length === 3) {
      return digits;
    }

    // 9-digit local numbers: prepend +998
    if (digits.length === 9) {
      return `+998${digits}`;
    }

    // 12-digit numbers starting with 998: prepend +
    if (digits.length === 12 && digits.startsWith('998')) {
      return `+${digits}`;
    }

    // If it already starts with + and has 12 digits (+998...)
    if (phone.startsWith('+') && digits.length === 12) {
      return phone;
    }

    // Fallback for other cases where it doesn't start with + but has 10+ digits
    if (!phone.startsWith('+') && digits.length >= 10) {
      return `+${digits}`;
    }

    return phone;
  }

  async handleWebhook(payload: Record<string, unknown>): Promise<void> {
    // TEMPORARY LOGGING FOR TESTING
    try {
      await this.knex('online_pbx_webhook_logs').insert({
        payload: payload,
        created_at: new Date().toISOString(),
      });
    } catch (logError: unknown) {
      const errorMessage = logError instanceof Error ? logError.message : String(logError);
      this.logger.error(`[OnlinePBX Webhook] Failed to log raw payload: ${errorMessage}`);
    }

    this.logger.log(`[OnlinePBX Webhook] Received payload: ${JSON.stringify(payload)}`);

    const {
      uuid,
      direction,
      event,
      call_duration,
      dialog_duration,
      hangup_cause,
      download_url: rawDownloadUrl,
    } = payload as unknown as OnlinePbxWebhookPayload;
    const { caller, callee } = payload as unknown as OnlinePbxWebhookPayload;

    let download_url = rawDownloadUrl;
    if (download_url && typeof download_url === 'string' && download_url.startsWith('http://')) {
      download_url = download_url.replace('http://', 'https://');
    }

    if (!uuid) return;

    const gateway = this.config.get<string>('GATEWAY');
    let userId: string | null = null;
    let repairOrderId: string | null = null;

    // Distinguish between customer and staff (admin)
    let customerPhoneRaw: string | undefined;

    if (direction === 'inbound') {
      customerPhoneRaw = caller;
    } else if (direction === 'outbound') {
      customerPhoneRaw = callee;
    }

    // Role verification using GATEWAY - if either side is our gateway, that side is staff
    const formattedCaller = this.formatPhone(caller);
    const formattedCallee = this.formatPhone(callee);
    const formattedGateway = this.formatPhone(gateway);

    if (formattedCaller && formattedGateway && formattedCaller === formattedGateway) {
      customerPhoneRaw = callee;
    } else if (formattedCallee && formattedGateway && formattedCallee === formattedGateway) {
      customerPhoneRaw = caller;
    }

    const formattedCustomerPhone = this.formatPhone(customerPhoneRaw);

    // Identify Customer
    if (formattedCustomerPhone) {
      const user = await this.knex<User>('users')
        .where('phone_number1', formattedCustomerPhone)
        .first();
      if (user) {
        userId = user.id;
      }
    }
    if (formattedCustomerPhone) {
      // Don't create repair orders for internal calls (admin to admin)
      // or if the customer phone is actually our gateway
      const isAdmin = await this.knex('admins')
        .where('phone_number', formattedCustomerPhone)
        .first();

      if (isAdmin || (formattedGateway && formattedCustomerPhone === formattedGateway)) {
        this.logger.log(
          `[OnlinePBX Webhook] Skipping repair order logic for ${isAdmin ? 'admin' : 'gateway'} number ${formattedCustomerPhone}`,
        );
      } else {
        // Inbound & Outbound call handling logic (tracking customer's repair orders)
        // Look for an existing open repair order for this customer
        const defaultBranch = '00000000-0000-4000-8000-000000000000';
        const openOrder = await this.repairOrderService.findOpenOrderByPhoneNumber(
          defaultBranch,
          formattedCustomerPhone,
          userId,
        );

        if (openOrder) {
          repairOrderId = openOrder.id;
        }

        if (event === 'call_start' || event === 'call_answered') {
          if (!openOrder) {
            // Create repair order for both inbound and outbound calls if no order exists
            if (event === 'call_start') {
              const defaultStatus = '50000000-0000-0000-0001-001000000000';

              if (defaultBranch && defaultStatus) {
                const newOrder = await this.repairOrderService.createFromWebhook({
                  userId,
                  branchId: defaultBranch,
                  statusId: defaultStatus,
                  phoneNumber: formattedCustomerPhone,
                  source: direction === 'inbound' ? 'Kiruvchi qongiroq' : 'Chiquvchi qongiroq',
                });

                if (newOrder) {
                  repairOrderId = newOrder.id;
                }

                this.logger.log(
                  `Created new repair order for ${userId ? `user ${userId}` : `unknown caller ${formattedCustomerPhone}`} from ${direction} call via RepairOrdersService.`,
                );
              } else {
                this.logger.warn(
                  `[OnlinePBX Webhook] Cannot create repair order. Missing master data: Branch=${!!defaultBranch}, Status=${!!defaultStatus}`,
                );
              }
            }
          } else {
            // For either inbound or outbound, if we find an open order, we update it
            if (event === 'call_start') {
              await this.repairOrderService.incrementCallCount(openOrder.id);
              this.logger.log(
                `Incremented call_count for existing open repair order ${openOrder.id} via RepairOrdersService.`,
              );
            }
          }
        } else if (event === 'call_missed') {
          if (openOrder) {
            await this.repairOrderService.incrementMissedCallCount(openOrder.id);
            this.logger.log(
              `Incremented missed_calls for existing open repair order ${openOrder.id} via RepairOrdersService.`,
            );
          }
        }
      }
    }

    // Upsert phone_call record using Knex's built-in support
    await this.knex<PhoneCall>('phone_calls')
      .insert({
        uuid,
        caller: formattedCaller,
        callee: formattedCallee,
        direction: (direction as string) || null,
        event: (event as string) || null,
        call_duration: call_duration ? Number(call_duration) : null,
        dialog_duration: dialog_duration ? Number(dialog_duration) : null,
        hangup_cause: hangup_cause || null,
        download_url: download_url || null,
        user_id: userId,
        repair_order_id: repairOrderId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .onConflict('uuid')
      .merge({
        event: event || undefined,
        call_duration: call_duration ? Number(call_duration) : undefined,
        dialog_duration: dialog_duration ? Number(dialog_duration) : undefined,
        hangup_cause: hangup_cause || undefined,
        download_url: download_url || undefined,
        user_id: userId || undefined,
        repair_order_id: repairOrderId || undefined,
        updated_at: new Date().toISOString(),
      });
  }
}
