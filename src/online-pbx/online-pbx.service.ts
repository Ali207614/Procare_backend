import { Injectable } from '@nestjs/common';
import { LoggerService } from 'src/common/logger/logger.service';
import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as https from 'https';
import { User } from 'src/common/types/user.interface';
import { RepairOrder } from 'src/common/types/repair-order.interface';
import { Branch } from 'src/common/types/branch.interface';
import { PhoneCategory } from 'src/common/types/phone-category.interface';
import { RepairOrderStatus } from 'src/common/types/repair-order-status.interface';

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

@Injectable()
export class OnlinePbxService {
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;

  constructor(
    private readonly logger: LoggerService,
    private readonly config: ConfigService,
    @InjectKnex() private readonly knex: Knex,
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

  async handleWebhook(payload: Record<string, unknown>): Promise<void> {
    this.logger.log(`[OnlinePBX Webhook] Received payload: ${JSON.stringify(payload)}`);

    const {
      uuid,
      caller,
      callee,
      direction,
      event,
      call_duration,
      dialog_duration,
      hangup_cause,
      download_url: rawDownloadUrl,
    } = payload as unknown as OnlinePbxWebhookPayload;

    let download_url = rawDownloadUrl;
    if (download_url && typeof download_url === 'string' && download_url.startsWith('http://')) {
      download_url = download_url.replace('http://', 'https://');
    }

    if (!uuid) return;

    // Distinguish between customer and staff (admin)
    let customerPhoneRaw: string | undefined;
    let staffPhoneRaw: string | undefined;

    const gateway = this.config.get<string>('GATEWAY');

    if (direction === 'inbound') {
      customerPhoneRaw = caller;
      staffPhoneRaw = callee;
    } else if (direction === 'outbound') {
      customerPhoneRaw = callee;
      staffPhoneRaw = caller;
    }

    // Helper to format phone number to DB standard +998XXXXXXXXX
    const formatPhone = (phone: string | undefined): string | null => {
      if (!phone || typeof phone !== 'string') return null;
      if (phone.startsWith('998') && phone.length === 12) {
        return '+' + phone;
      } else if (phone.length === 9) {
        return '+998' + phone;
      } else if (!phone.startsWith('+')) {
        return '+' + phone;
      }
      return phone;
    };

    // Role verification using GATEWAY - if either side is our gateway, that side is staff
    const formattedCaller = formatPhone(caller);
    const formattedCallee = formatPhone(callee);
    const formattedGateway = formatPhone(gateway);

    if (formattedCaller && formattedGateway && formattedCaller === formattedGateway) {
      // Caller is our gateway, so he must be staff/company side
      customerPhoneRaw = callee;
      staffPhoneRaw = caller;
    } else if (formattedCallee && formattedGateway && formattedCallee === formattedGateway) {
      // Callee is our gateway, so he must be staff/company side
      customerPhoneRaw = caller;
      staffPhoneRaw = callee;
    }

    const formattedCustomerPhone = formatPhone(customerPhoneRaw);
    const formattedStaffPhone = formatPhone(staffPhoneRaw);

    let userId: string | null = null;
    let adminId: string | null = null;
    let repairOrderId: string | null = null;

    // Identify Customer
    if (formattedCustomerPhone) {
      const user = await this.knex<User>('users')
        .where('phone_number1', formattedCustomerPhone)
        .first();
      if (user) {
        userId = user.id;
      }
    }

    // Identify Staff (Admin)
    if (formattedStaffPhone) {
      const admin = await this.knex('admins').where('phone_number', formattedStaffPhone).first();
      if (admin) {
        adminId = admin.id;
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
        let query = this.knex<RepairOrder>('repair_orders').whereNotIn('status', [
          'Cancelled',
          'Deleted',
          'Closed',
        ]);

        if (userId) {
          query = query.andWhere((qb): void => {
            void qb.where({ user_id: userId }).orWhere({ phone_number: formattedCustomerPhone });
          });
        } else {
          query = query.where({ phone_number: formattedCustomerPhone });
        }

        const openOrder = await query.first();
        if (openOrder) {
          repairOrderId = openOrder.id;
        }

        const assignAdminToOrder = async (orderId: string, aId: string): Promise<void> => {
          await this.knex('repair_order_assign_admins')
            .insert({
              repair_order_id: orderId,
              admin_id: aId,
              created_at: new Date().toISOString(),
            })
            .onConflict(['repair_order_id', 'admin_id'])
            .ignore();
        };

        if (event === 'call_start' || event === 'call_answered') {
          if (!openOrder) {
            // Create repair order for both inbound and outbound calls if no order exists
            if (event === 'call_start') {
              const defaultBranch = await this.knex<Branch>('branches').first();
              const defaultCategory = await this.knex<PhoneCategory>('phone_categories')
                .where('status', 'Open')
                .first();
              const defaultStatus = await this.knex<RepairOrderStatus>('repair_order_statuses')
                .orderBy('sort', 'asc')
                .first();

              if (defaultBranch && defaultCategory && defaultStatus) {
                const sortResult = await this.knex('repair_orders')
                  .where('branch_id', defaultBranch.id)
                  .max<{ max_sort: number | string }>('sort as max_sort')
                  .first();
                const nextSort = sortResult?.max_sort ? Number(sortResult.max_sort) + 1 : 1;

                const [newOrder] = await this.knex<RepairOrder>('repair_orders')
                  .insert({
                    user_id: userId,
                    branch_id: defaultBranch.id,
                    phone_category_id: defaultCategory.id,
                    priority: 'Medium',
                    status_id: defaultStatus.id,
                    sort: nextSort,
                    delivery_method: 'Self',
                    pickup_method: 'Self',
                    created_by: adminId, // Link to admin who handled the call
                    phone_number: formattedCustomerPhone,
                    name: userId ? null : null,
                    source: direction === 'inbound' ? 'Kiruvchi qongiroq' : 'Chiquvchi qongiroq',
                    call_count: 1,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  })
                  .returning('*');

                if (newOrder) {
                  repairOrderId = newOrder.id;
                  if (adminId) {
                    await assignAdminToOrder(newOrder.id, adminId);
                  }
                }

                this.logger.log(
                  `Created new repair order for ${userId ? `user ${userId}` : `unknown caller ${formattedCustomerPhone}`} from ${direction} call.`,
                );
              }
            }
          } else {
            // For either inbound or outbound, if we find an open order, we update it
            if (event === 'call_start') {
              await this.knex('repair_orders')
                .where({ id: openOrder.id })
                .increment('call_count', 1);
              this.logger.log(
                `Incremented call_count for existing open repair order ${openOrder.id}.`,
              );
            }

            // Automatically assign the staff member to the open order
            if (adminId) {
              await assignAdminToOrder(openOrder.id, adminId);
              this.logger.log(
                `Assigned admin ${adminId} to existing open repair order ${openOrder.id} from call.`,
              );
            }
          }
        } else if (event === 'call_missed') {
          if (openOrder) {
            await this.knex('repair_orders')
              .where({ id: openOrder.id })
              .increment('missed_calls', 1);
            this.logger.log(
              `Incremented missed_calls for existing open repair order ${openOrder.id}.`,
            );
          }
        }
      }
    }

    // Upsert phone_call record using Knex
    const existingCall = await this.knex<PhoneCall>('phone_calls').where('uuid', uuid).first();

    if (existingCall) {
      await this.knex<PhoneCall>('phone_calls')
        .where('uuid', uuid)
        .update({
          event: event || existingCall.event,
          call_duration: call_duration ? Number(call_duration) : existingCall.call_duration,
          dialog_duration: dialog_duration ? Number(dialog_duration) : existingCall.dialog_duration,
          hangup_cause: hangup_cause || existingCall.hangup_cause,
          download_url: download_url || existingCall.download_url,
          user_id: userId || existingCall.user_id,
          repair_order_id: repairOrderId || existingCall.repair_order_id,
          updated_at: new Date().toISOString(),
        });
    } else {
      await this.knex<PhoneCall>('phone_calls').insert({
        uuid,
        caller: (caller as string) || null,
        callee: (callee as string) || null,
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
      });
    }
  }
}
