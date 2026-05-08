import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from 'src/common/logger/logger.service';
import { InjectKnex } from 'nestjs-knex';
import { Knex } from 'knex';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { RepairOrderDetails } from 'src/common/types/repair-order.interface';

interface BranchWebhookInfo {
  webhook_url: string;
  webhook_auth_header: string;
  branch_id: string;
}

@Injectable()
export class RepairOrderWebhookService {
  private readonly webhookUrl: string | undefined;
  private readonly authHeader: string | undefined;
  private readonly queryPattern: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
    @InjectKnex() private readonly knex: Knex,
  ) {
    this.webhookUrl = this.configService.get<string>('OUTGOING_WEBHOOK_URL');
    this.authHeader = this.configService.get<string>('OUTGOING_WEBHOOK_AUTH_HEADER');

    // Load the query used by findById to ensure the exact same payload shape
    const queryPath = path.join(process.cwd(), 'src', 'repair-orders', 'queries', 'find-by-id.sql');
    this.queryPattern = fs.readFileSync(queryPath, 'utf8');
  }

  async sendWebhook(repairOrderId: string): Promise<void> {
    try {
      // 1. Fetch repair order branch and its specific webhook settings
      const branchInfo = await this.knex('repair_orders as ro')
        .join('branches as b', 'ro.branch_id', 'b.id')
        .where('ro.id', repairOrderId)
        .select<BranchWebhookInfo>('b.webhook_url', 'b.webhook_auth_header', 'ro.branch_id')
        .first();

      if (!branchInfo) {
        this.logger.warn(
          `[RepairOrderWebhook] Could not find branch info for order ${repairOrderId}`,
        );
        return;
      }

      // Priority: 1. Branch specific URL, 2. Global URL
      const targetUrl = branchInfo.webhook_url || this.webhookUrl;
      const targetAuth = branchInfo.webhook_auth_header || this.authHeader;

      if (!targetUrl) {
        // No webhook configured globally or for this branch
        return;
      }

      // 2. Fetch the exact payload as returned by the GET /repair-orders/:id endpoint
      const result = await this.knex.raw<{ rows: RepairOrderDetails[] }>(this.queryPattern, {
        orderId: repairOrderId,
      });

      const payload = result.rows[0];

      if (!payload) {
        this.logger.warn(
          `[RepairOrderWebhook] Could not find repair order ${repairOrderId} to send payload.`,
        );
        return;
      }

      // 3. Prepare Headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (targetAuth) {
        headers['Authorization'] = targetAuth;
      }

      // 4. Dispatch Webhook
      this.logger.log(
        `[RepairOrderWebhook] Sending repair order ${repairOrderId} to ${targetUrl} (Branch: ${branchInfo.branch_id})`,
      );
      await axios.post(targetUrl, payload, {
        headers,
        timeout: 10000, // 10s timeout to prevent hanging connections
      });

      this.logger.log(`[RepairOrderWebhook] Successfully sent repair order ${repairOrderId}`);
    } catch (error: unknown) {
      // We only catch and log so that we don't disrupt the main application flow
      if (axios.isAxiosError(error)) {
        this.logger.error(
          `[RepairOrderWebhook] Webhook delivery failed for ${repairOrderId}: ${error.message} - ${error.response?.status}`,
        );
      } else {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `[RepairOrderWebhook] Error processing webhook for ${repairOrderId}: ${msg}`,
        );
      }
    }
  }
}
