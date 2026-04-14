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
  gateway?: string;
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

const DEFAULT_BRANCH_ID = '00000000-0000-4000-8000-000000000000';
const DEFAULT_SYSTEM_ADMIN_ID = '00000000-0000-4000-8000-000000000000';

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

  private normalizeGatewayValue(value: unknown): string | null {
    if (value === null || value === undefined) return null;

    return this.formatPhone(String(value));
  }

  async handleWebhook(payload: Record<string, unknown>): Promise<void> {
    const { gateway: payloadGateway } = payload as unknown as OnlinePbxWebhookPayload;
    const normalizedPayloadGateway = this.normalizeGatewayValue(payloadGateway);
    const normalizedProjectGateway = this.formatPhone('781133774');

    if (!normalizedPayloadGateway || normalizedPayloadGateway !== normalizedProjectGateway) {
      this.logger.log(
        `[OnlinePBX Webhook] Ignoring payload for gateway ${payloadGateway || 'unknown'}. Not related to this project.`,
      );
      return;
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

    const existingCall = await this.knex<PhoneCall>('phone_calls')
      .where({ uuid })
      .first('uuid', 'event', 'dialog_duration', 'repair_order_id');

    const parsedDialogDuration = this.parsePositiveDuration(dialog_duration);
    const gateway = this.config.get<string>('GATEWAY');
    let userId: string | null = null;
    let repairOrderId: string | null = null;

    // Distinguish between customer and staff (admin)
    let customerPhoneRaw: string | undefined;
    let onlinepbxCode: string | null = null;

    if (direction === 'inbound') {
      customerPhoneRaw = caller;
      const calleeDigits = callee?.replace(/\D/g, '');
      if (calleeDigits?.length === 3) onlinepbxCode = calleeDigits;
    } else if (direction === 'outbound') {
      customerPhoneRaw = callee;
      const callerDigits = caller?.replace(/\D/g, '');
      if (callerDigits?.length === 3) onlinepbxCode = callerDigits;
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
        const openOrder = await this.repairOrderService.findOpenOrderByPhoneNumber(
          DEFAULT_BRANCH_ID,
          formattedCustomerPhone,
          userId,
        );

        if (openOrder) {
          repairOrderId = openOrder.id;
        }

        const createOrderHelper = async (
          pbxCode: string | null,
          fallback: boolean,
        ): Promise<void> => {
          const defaultStatus = '50000000-0000-0000-0001-001000000000';
          if (DEFAULT_BRANCH_ID && defaultStatus) {
            const newOrder = await this.repairOrderService.createFromWebhook({
              userId,
              branchId: DEFAULT_BRANCH_ID,
              statusId: defaultStatus,
              phoneNumber: formattedCustomerPhone,
              source: direction === 'inbound' ? 'Kiruvchi qongiroq' : 'Chiquvchi qongiroq',
              onlinepbxCode: pbxCode,
              fallbackToFewestOpen: fallback,
            });
            if (newOrder) {
              userId = newOrder.user_id || userId;
              repairOrderId = newOrder.id;
            }
            this.logger.log(
              `Created new repair order for ${userId ? `user ${userId}` : `caller ${formattedCustomerPhone}`} from ${direction} call via RepairOrdersService.`,
            );
          } else {
            this.logger.warn(
              `[OnlinePBX Webhook] Cannot create repair order. Missing master data: Branch=${!!DEFAULT_BRANCH_ID}, Status=${!!defaultStatus}`,
            );
          }
        };

        if (direction === 'outbound') {
          // Admin calling user
          if (event === 'call_start') {
            if (!openOrder) {
              // Create if doesn't exist, assigning to caller without fallback
              await createOrderHelper(onlinepbxCode, false);
            } else {
              const callerDigits = caller?.replace(/\D/g, '');
              const specificAdminCode = callerDigits?.length === 3 ? callerDigits : onlinepbxCode;

              await this.repairOrderService.assignTelephonyAdminToExistingOrder({
                branchId: DEFAULT_BRANCH_ID,
                orderId: openOrder.id,
                onlinepbxCode: specificAdminCode,
              });
              await this.repairOrderService.incrementCallCount(openOrder.id);
              this.logger.log(
                `Incremented call_count for existing open repair order ${openOrder.id} via RepairOrdersService.`,
              );
            }
          } else if (event === 'call_answered') {
            const callerDigits = caller?.replace(/\D/g, '');
            const specificAdminCode = callerDigits?.length === 3 ? callerDigits : onlinepbxCode;

            await this.repairOrderService.handleCallAnswered({
              branchId: DEFAULT_BRANCH_ID,
              phoneNumber: formattedCustomerPhone,
              onlinepbxCode: specificAdminCode || '',
              userId,
              openMenu: true,
              source: 'Chiquvchi qongiroq',
            });
            this.logger.log(
              `Handled outbound call_answered for ${formattedCustomerPhone} via handleCallAnswered.`,
            );
          } else if (event === 'call_end' && parsedDialogDuration > 0) {
            if (!openOrder) {
              const callerDigits = caller?.replace(/\D/g, '');
              const specificAdminCode = callerDigits?.length === 3 ? callerDigits : onlinepbxCode;
              await createOrderHelper(specificAdminCode, false);
            } else {
              await this.repairOrderService.moveToTopById(openOrder.id);
              this.logger.log(
                `Moved existing open repair order ${openOrder.id} to top on outbound call_end with duration > 0.`,
              );
            }
          }
        } else if (direction === 'inbound') {
          // User calling admin
          if (event === 'call_start') {
            if (openOrder) {
              // Only increment if already exists; don't create yet
              await this.repairOrderService.incrementCallCount(openOrder.id);
              await this.repairOrderService.notifyAvailableAssignedAdminsForIncomingCall(
                openOrder.id,
              );
              this.logger.log(
                `Incremented call_count for existing open repair order ${openOrder.id} via RepairOrdersService.`,
              );
            }
          } else if (event === 'call_answered') {
            const calleeDigits = callee?.replace(/\D/g, '');
            const specificAdminCode = calleeDigits?.length === 3 ? calleeDigits : onlinepbxCode;

            await this.repairOrderService.handleCallAnswered({
              branchId: DEFAULT_BRANCH_ID,
              phoneNumber: formattedCustomerPhone,
              onlinepbxCode: specificAdminCode || '',
              userId,
              openMenu: true,
              source: 'Kiruvchi qongiroq',
            });
            this.logger.log(
              `Handled call_answered for ${formattedCustomerPhone} via handleCallAnswered.`,
            );
          } else if (event === 'call_missed') {
            if (!openOrder) {
              // Missed call: create and use fallback logic
              await createOrderHelper(null, true);
            } else {
              // Increment missed calls count on existing order
              await this.repairOrderService.incrementMissedCallCount(openOrder.id);
              this.logger.log(
                `Incremented missed_calls for existing open repair order ${openOrder.id} via RepairOrdersService.`,
              );
            }
          } else if (event === 'call_end') {
            // Check if admin actually talked to user
            if (parsedDialogDuration > 0) {
              if (!openOrder) {
                // Determine which admin answered from callee directly
                const calleeDigits = callee?.replace(/\D/g, '');
                const specificAdminCode = calleeDigits?.length === 3 ? calleeDigits : onlinepbxCode;
                // Create and strictly assign to whoever answered
                await createOrderHelper(specificAdminCode, false);
              } else {
                // If it exists, move to top again as the interaction just completed
                await this.repairOrderService.moveToTopById(openOrder.id);
                this.logger.log(
                  `Moved existing open repair order ${openOrder.id} to top on call_end with duration > 0.`,
                );
              }
            }
          }
        }
      }
    }

    const shouldCreateTalkComment =
      Boolean(repairOrderId) &&
      this.shouldCreateRepairOrderComment(event, parsedDialogDuration) &&
      !this.hasCallCommentRecorded(existingCall, event, parsedDialogDuration);
    const conversationAdminCode = this.resolveConversationAdminCode(
      direction,
      caller,
      callee,
      onlinepbxCode,
    );

    // Upsert phone_call record using Knex's built-in support
    this.logger.log(
      `[OnlinePBX Webhook] Saving phone call ${uuid} with user_id: ${userId} and repair_order_id: ${repairOrderId}`,
    );
    await this.knex.transaction(async (trx) => {
      await trx<PhoneCall>('phone_calls')
        .insert({
          uuid,
          caller: formattedCaller,
          callee: formattedCallee,
          direction: (direction as string) || null,
          event: (event as string) || null,
          call_duration: call_duration ? Number(call_duration) : null,
          dialog_duration: parsedDialogDuration || null,
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
          dialog_duration: parsedDialogDuration || undefined,
          hangup_cause: hangup_cause || undefined,
          download_url: download_url || undefined,
          user_id: userId || undefined,
          repair_order_id: repairOrderId || undefined,
          updated_at: new Date().toISOString(),
        });

      if (shouldCreateTalkComment && repairOrderId) {
        await this.insertRepairOrderComment(trx, {
          repairOrderId,
          onlinepbxCode: conversationAdminCode,
          event,
          direction,
          dialogDuration: parsedDialogDuration,
        });
      }
    });
  }

  private parsePositiveDuration(value: string | number | undefined): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  private shouldCreateRepairOrderComment(
    event: string | undefined,
    dialogDuration: number,
  ): boolean {
    return event === 'call_missed' || (event === 'call_end' && dialogDuration > 0);
  }

  private hasCallCommentRecorded(
    call: Pick<PhoneCall, 'event' | 'dialog_duration'> | undefined,
    event: string | undefined,
    dialogDuration: number,
  ): boolean {
    if (!call) {
      return false;
    }

    if (event === 'call_missed') {
      return call.event === 'call_missed';
    }

    return event === 'call_end' && dialogDuration > 0 && call.event === 'call_end' && Number(call.dialog_duration) > 0;
  }

  private resolveConversationAdminCode(
    direction: string | undefined,
    caller: string | undefined,
    callee: string | undefined,
    fallbackCode: string | null,
  ): string | null {
    const callerDigits = caller?.replace(/\D/g, '');
    const calleeDigits = callee?.replace(/\D/g, '');

    if (direction === 'outbound') {
      return callerDigits?.length === 3 ? callerDigits : fallbackCode;
    }

    if (direction === 'inbound') {
      return calleeDigits?.length === 3 ? calleeDigits : fallbackCode;
    }

    return fallbackCode;
  }

  private async insertRepairOrderComment(
    trx: Knex.Transaction,
    data: {
      repairOrderId: string;
      onlinepbxCode: string | null;
      event?: string;
      direction?: string;
      dialogDuration: number;
    },
  ): Promise<void> {
    const order = await trx('repair_orders')
      .where({ id: data.repairOrderId, status: 'Open' })
      .first<{ status_id: string }>('status_id');

    if (!order?.status_id) {
      return;
    }

    const createdBy = await this.resolveTalkCommentCreatorId(trx, data.onlinepbxCode);
    const text = this.buildRepairOrderCommentText(data.event, data.direction, data.dialogDuration);

    await trx('repair_order_comments').insert({
      repair_order_id: data.repairOrderId,
      text,
      status: 'Open',
      created_by: createdBy,
      status_by: order.status_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  private async resolveTalkCommentCreatorId(
    trx: Knex.Transaction,
    onlinepbxCode: string | null,
  ): Promise<string> {
    if (onlinepbxCode) {
      const adminByCode = await trx('admins')
        .where({
          onlinepbx_code: onlinepbxCode,
          is_active: true,
          status: 'Open',
        })
        .first<{ id: string }>('id');

      if (adminByCode?.id) {
        return adminByCode.id;
      }
    }

    const systemAdmin = await trx('admins')
      .where({ id: DEFAULT_SYSTEM_ADMIN_ID })
      .first<{ id: string }>('id');
    if (systemAdmin?.id) {
      return systemAdmin.id;
    }

    const firstAdmin = await trx('admins').orderBy('created_at', 'asc').first<{ id: string }>('id');
    if (!firstAdmin?.id) {
      throw new Error('No admin found to attribute telephony talk comment');
    }

    return firstAdmin.id;
  }

  private buildRepairOrderCommentText(
    event: string | undefined,
    direction: string | undefined,
    dialogDuration: number,
  ): string {
    if (event === 'call_missed') {
      if (direction === 'outbound') {
        return `Chiquvchi qo'ng'iroq o'tkazib yuborildi`;
      }

      return `Kiruvchi qo'ng'iroq o'tkazib yuborildi`;
    }

    const directionLabel =
      direction === 'inbound'
        ? "kiruvchi qo'ng'iroq"
        : direction === 'outbound'
          ? "chiquvchi qo'ng'iroq"
          : 'telefon suhbati';

    return `Mijoz bilan ${directionLabel} bo'lib o'tdi (${this.formatDuration(dialogDuration)})`;
  }

  private formatDuration(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes > 0 && seconds > 0) {
      return `${minutes} daqiqa ${seconds} soniya`;
    }

    if (minutes > 0) {
      return `${minutes} daqiqa`;
    }

    return `${seconds} soniya`;
  }
}
