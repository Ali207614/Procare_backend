import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '.env') });

const PRODUCTION_SERVER_URL = process.env.PRODUCTION_SERVER_URL;
const TEST_PHONE_NUMBER = process.env.TEST_PHONE_NUMBER;
const TEST_PASSWORD = process.env.TEST_PASSWORD;
const API_PREFIX = '/api/v1';

if (!PRODUCTION_SERVER_URL || !TEST_PHONE_NUMBER || !TEST_PASSWORD) {
  console.error('❌ Error: Missing required environment variables');
  console.error('Please ensure .env file contains:');
  console.error('  - PRODUCTION_SERVER_URL');
  console.error('  - TEST_PHONE_NUMBER');
  console.error('  - TEST_PASSWORD');
  process.exit(1);
}

const config = {
  productionServerUrl: PRODUCTION_SERVER_URL,
  testPhoneNumber: TEST_PHONE_NUMBER,
  testPassword: TEST_PASSWORD,
};

const repairOrderUUID = process.argv[2];
if (!repairOrderUUID) {
  console.error('❌ Error: Repair order UUID not provided');
  console.error('Usage: ts-node get-repair-order.ts <repair-order-uuid>');
  process.exit(1);
}

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!uuidRegex.test(repairOrderUUID)) {
  console.error('❌ Error: Invalid UUID format');
  console.error('Expected format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
  process.exit(1);
}

interface LoginResponse {
  access_token: string;
}

interface RepairOrder {
  id: string;
  user_id?: string;
  user?: { id?: string; full_name?: string; first_name?: string; last_name?: string };
  phone_category_id?: string;
  phone_category?: { id?: string; name?: string };
  status_id?: string;
  repair_order_status?: { id?: string; name?: string };
  priority: string;
  source: string;
  branch_id?: string;
  branch?: { id?: string; name?: string };
  created_at: string;
  updated_at?: string;
  [key: string]: any;
}

interface HistoryEvent {
  event: {
    id: string;
    occurred_at: string;
    action_key: string;
    source_type?: string;
    source_id?: string;
  };
  entities: any[];
  changes: Array<{
    field_path: string;
    old_value_text: string | null;
    new_value_text: string | null;
  }>;
  actors: Array<{
    id: string;
    actor_type: string;
    name: string;
  }>;
}

interface TimelineResponse {
  rows: HistoryEvent[];
  total: number;
  limit: number;
  offset: number;
}

function normalizeApiBaseUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  url.pathname = url.pathname.replace(/\/+$/, '');

  if (!url.pathname.endsWith(API_PREFIX)) {
    url.pathname = `${url.pathname}${API_PREFIX}`.replace(/\/{2,}/g, '/');
  }

  return url.toString().replace(/\/+$/, '');
}

function normalizeUzPhoneNumber(phoneNumber: string): string {
  const trimmed = phoneNumber.trim();

  if (/^998[0-9]{9}$/.test(trimmed)) {
    return `+${trimmed}`;
  }

  return trimmed;
}

function displayValue(...values: Array<string | number | null | undefined>): string {
  const value = values.find((item) => item !== undefined && item !== null && item !== '');
  return value === undefined ? 'N/A' : String(value);
}

function formatDate(value: string | undefined): string {
  if (!value) {
    return 'N/A';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
}

function toHttpsUrl(rawUrl: string): string | null {
  const url = new URL(rawUrl);
  const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);

  if (url.protocol !== 'http:' || isLocalhost) {
    return null;
  }

  url.protocol = 'https:';
  return url.toString().replace(/\/+$/, '');
}

async function responseText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

async function postLogin(apiBaseUrl: string): Promise<Response> {
  return fetch(`${apiBaseUrl}/auth/admin/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      phone_number: normalizeUzPhoneNumber(config.testPhoneNumber),
      password: config.testPassword,
    }),
  });
}

async function main() {
  try {
    let apiBaseUrl = normalizeApiBaseUrl(config.productionServerUrl);

    console.log('🔐 Authenticating...');
    let loginResponse = await postLogin(apiBaseUrl);

    const httpsApiBaseUrl = toHttpsUrl(apiBaseUrl);
    if (!loginResponse.ok && loginResponse.status === 404 && httpsApiBaseUrl) {
      console.log('↪️  HTTP login returned 404; retrying with HTTPS...');
      const httpsLoginResponse = await postLogin(httpsApiBaseUrl);

      if (httpsLoginResponse.ok || httpsLoginResponse.status !== loginResponse.status) {
        apiBaseUrl = httpsApiBaseUrl;
        loginResponse = httpsLoginResponse;
      }
    }

    if (!loginResponse.ok) {
      const body = await responseText(loginResponse);
      throw new Error(
        `Authentication failed: ${loginResponse.status} ${loginResponse.statusText}${
          body ? ` - ${body}` : ''
        }`,
      );
    }

    const { access_token } = (await loginResponse.json()) as LoginResponse;
    console.log('✅ Authentication successful\n');

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${access_token}`,
    };

    console.log(`📋 Fetching repair order: ${repairOrderUUID}`);
    const repairOrderResponse = await fetch(
      `${apiBaseUrl}/repair-orders/${repairOrderUUID}`,
      { headers },
    );

    if (!repairOrderResponse.ok) {
      const body = await responseText(repairOrderResponse);
      throw new Error(
        `Failed to fetch repair order: ${repairOrderResponse.status} ${repairOrderResponse.statusText}${
          body ? ` - ${body}` : ''
        }`,
      );
    }

    const repairOrder = (await repairOrderResponse.json()) as RepairOrder;
    console.log('✅ Repair order fetched\n');

    console.log(`📜 Fetching repair order history...`);
    const historyResponse = await fetch(
      `${apiBaseUrl}/history/entities/repair_orders/${repairOrderUUID}/timeline`,
      { headers },
    );

    if (!historyResponse.ok) {
      const body = await responseText(historyResponse);
      throw new Error(
        `Failed to fetch history: ${historyResponse.status} ${historyResponse.statusText}${
          body ? ` - ${body}` : ''
        }`,
      );
    }

    const timeline = (await historyResponse.json()) as TimelineResponse;
    console.log('✅ History fetched\n');

    // Display structured information
    console.log('═'.repeat(80));
    console.log('REPAIR ORDER INFORMATION');
    console.log('═'.repeat(80));
    console.log(`ID: ${repairOrder.id}`);
    console.log(
      `Status: ${displayValue(repairOrder.repair_order_status?.name, repairOrder.status_id)}`,
    );
    console.log(`Priority: ${repairOrder.priority}`);
    console.log(`Source: ${repairOrder.source}`);
    console.log(`Branch: ${displayValue(repairOrder.branch?.name, repairOrder.branch_id)}`);
    console.log(`User: ${displayValue(repairOrder.user?.full_name, repairOrder.user_id)}`);
    console.log(
      `Phone Category: ${displayValue(
        repairOrder.phone_category?.name,
        repairOrder.phone_category_id,
      )}`,
    );
    console.log(`Created: ${formatDate(repairOrder.created_at)}`);
    console.log(`Updated: ${formatDate(repairOrder.updated_at)}`);

    if (repairOrder.customer_name) {
      console.log(`Customer Name: ${repairOrder.customer_name}`);
    }
    if (repairOrder.device_serial) {
      console.log(`Device Serial: ${repairOrder.device_serial}`);
    }

    console.log('\n' + '═'.repeat(80));
    console.log('REPAIR ORDER TIMELINE');
    console.log('═'.repeat(80));
    console.log(`Total Events: ${timeline.total}\n`);

    timeline.rows.forEach((event, index) => {
      const eventNumber = index + 1;
      const timestamp = new Date(event.event.occurred_at).toLocaleString();
      const action = event.event.action_key;

      console.log(`\n📅 Event #${eventNumber}`);
      console.log(`   Time: ${timestamp}`);
      console.log(`   Action: ${action}`);
      console.log(`   Event ID: ${event.event.id}`);

      if (event.event.source_type) {
        console.log(`   Source Type: ${event.event.source_type}`);
      }

      if (event.actors && event.actors.length > 0) {
        console.log(`   Actors:`);
        event.actors.forEach((actor) => {
          console.log(`     - ${actor.name} (${actor.actor_type})`);
        });
      }

      if (event.changes && event.changes.length > 0) {
        console.log(`   Changes:`);
        event.changes.forEach((change) => {
          const oldValue = change.old_value_text ?? 'null';
          const newValue = change.new_value_text ?? 'null';
          console.log(`     - ${change.field_path}`);
          console.log(`       From: ${oldValue}`);
          console.log(`       To:   ${newValue}`);
        });
      }

      if (event.entities && event.entities.length > 0) {
        console.log(`   Related Entities: ${event.entities.length}`);
      }
    });

    console.log('\n' + '═'.repeat(80));
    console.log('✅ Done!');
    console.log('═'.repeat(80));
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
