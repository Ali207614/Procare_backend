# Lead Webhook & Auto-User Creation Plan

This document analyzes the current backend architecture and proposes a professional implementation plan for ingesting Google Sheet changes as "leads" and automatically creating users when a lead reaches a specific status.

## Architecture Snapshot (Current)
The backend is a NestJS monolith with domain modules under `src/`. It uses:
`Knex` for data access, `Redis` for caching, and `class-validator` DTOs for request validation.

Relevant modules:
`src/repair-orders` handles leads/repair orders.
`src/users` handles users.
`src/repair-order-statuses` and `src/repair-order-status-transitions` manage status workflows.

Key constraints:
`repair_orders.created_by` is required and references `admins`.
`repair_orders` already has `phone_number` and `name` columns.
`RepairOrdersService.create` requires `user_id` and other fields, so it cannot be reused for raw lead creation.
`RepairOrdersService.move` is the natural hook for “on status change” behavior.

## Requirements Recap
1. A Google Sheet triggers a webhook when the sheet changes.
2. The webhook does not include row-level change details.
3. Backend should fetch `phone_number` and `name` from the sheet and create a “lead” in `repair_orders`.
4. When a lead moves to a specific status, create a user from its `name` and `phone_number`.
5. User creation must be idempotent by `phone_number`.

## Proposed High-Level Design
1. Add a new public webhook endpoint that authenticates via a shared secret header.
2. On webhook receipt, fetch relevant sheet data and create “lead” repair orders.
3. Add idempotency to avoid duplicate leads.
4. On status change, create or attach a user automatically if the lead is in the trigger status.

## Data Model Changes
Minimal schema additions are recommended to support lead ingestion and idempotency.

### Option A (Recommended)
Add columns to `repair_orders`:
`source_type` enum, values like `google_sheets`, `manual`, `web`.
`source_ref` string, values like `sheet_id:tab_name:row_id`.
`source_hash` string, to avoid re-processing.

Add column to `repair_order_statuses`:
`create_user_on_enter` boolean, default `false`.

Add a new table `lead_ingest_state`:
`source_key`, `last_processed_at`, `last_row_hash`, `updated_at`.

### Option B (Lean)
No schema changes, store idempotency in Redis only.
This is faster but not durable across restarts and not recommended.

## Webhook Endpoint Design
Endpoint: `POST /webhooks/leads/google-sheets`

Public route with header auth:
`x-webhook-token: <secret>`

DTO example:
```
{
  "source_key": "leads-main",
  "sheet_id": "1abcDEF...",
  "tab_name": "Leads",
  "range": "A:D"
}
```

If the Apps Script cannot send these fields, store a `source_key -> sheet config` mapping in DB or env.

## Google Sheets Fetch Strategy
Because the webhook has no row-level detail, the backend must detect new rows or changes.

Recommended strategy:
1. Add an `updated_at` column in the sheet, set by Apps Script on edit.
2. Backend fetches all rows and selects rows with `updated_at > last_processed_at`.
3. For each row, build a `source_ref` and `source_hash`.
4. Insert a new lead only if `source_ref` or `source_hash` is new.
5. Update `lead_ingest_state.last_processed_at`.

If the sheet cannot support `updated_at`, use a row-hash strategy and detect new rows by scanning all rows and comparing against stored hashes.

## Lead Creation Flow
Add a new service method, for example:
`RepairOrdersService.createLeadFromWebhook(...)`

Behavior:
1. Validate phone number.
2. Normalize name and phone number.
3. Insert into `repair_orders` with:
`user_id = null`, `phone_number`, `name`,
`status_id = lead_status_id`,
`branch_id = default_branch_id`,
`phone_category_id = default_phone_category_id`,
`priority = 'Medium'`,
`delivery_method = 'Self'`,
`pickup_method = 'Self'`,
`created_by = LEAD_WEBHOOK_ADMIN_ID`.
4. Log if creation is skipped because it already exists.

## Auto-User Creation on Status Change
Add a hook inside `RepairOrdersService.move` after status change is confirmed.

Pseudocode:
```
if (newStatus.create_user_on_enter && !order.user_id) {
  user = usersService.findByPhone(order.phone_number);
  if (!user) user = usersService.createMinimal(order.name, order.phone_number, systemAdmin);
  update repair_orders set user_id = user.id
}
```

Notes:
`UsersService.create` currently requires an `AdminPayload`.
Introduce a `UsersService.findOrCreateByPhone` helper.
Use a system admin id from env, e.g. `LEAD_WEBHOOK_ADMIN_ID`.

## Security and Rate Limiting
1. Add webhook path to `PublicRoutes`.
2. Create `WebhookTokenGuard` that checks `x-webhook-token`.
3. Apply `RateLimiterByIpMiddleware` for this path.

## Configuration
Add to `.env`:
`LEAD_WEBHOOK_TOKEN`
`LEAD_WEBHOOK_ADMIN_ID`
`LEAD_DEFAULT_STATUS_ID`
`LEAD_DEFAULT_BRANCH_ID`
`LEAD_DEFAULT_PHONE_CATEGORY_ID`

If using Google Sheets API:
`GOOGLE_SHEETS_CLIENT_EMAIL`
`GOOGLE_SHEETS_PRIVATE_KEY`
`GOOGLE_SHEETS_PROJECT_ID`

## Implementation Steps
1. Create `src/webhooks` module with controller and service.
2. Add webhook DTOs and guard.
3. Add Google Sheets client service (or use Axios with service account JWT).
4. Implement `RepairOrdersService.createLeadFromWebhook`.
5. Add status-based auto user creation to `RepairOrdersService.move`.
6. Add DB migrations for optional schema changes.
7. Add tests for ingestion idempotency and user creation on status change.
8. Update Swagger docs and internal README.

## Testing Plan
Unit tests:
`createLeadFromWebhook` inserts minimal fields.
`move` auto-creates user only on configured status.
Idempotency checks prevent duplicate leads.

Integration tests:
Webhook endpoint with valid token.
Webhook endpoint with invalid token returns 401.
Webhook triggers lead creation and updates ingest state.

## Open Questions
1. Which status should trigger auto user creation.
2. Which branch and phone category should be used for leads.
3. Can the Google Sheet add an `updated_at` column for reliable change detection.
4. Whether we should use a DB table for webhook source config or environment variables are enough.
