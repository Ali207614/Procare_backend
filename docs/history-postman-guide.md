# History Module Postman Guide

This guide covers the new `history` module, how its endpoints behave today, which code paths feed it, and how to test it in Postman end to end.

## What The Module Actually Does

The `history` module is read-only from the API side:

- `GET /history/values/search`
- `GET /history/values/:current_value_id/lineage`
- `GET /history/entities/:table/:id/timeline`
- `GET /history/events/:event_id`

It is protected by:

- `JwtAdminAuthGuard`
- `PermissionsGuard`
- `history.view`

The module is wired into the app and exported from `HistoryModule`. Repair orders, admin/user/role/auth flows, and the main catalog/config modules now write into the global history tables.

## Current Local Database Snapshot

From the live local database in this workspace:

- `history_tracked_fields`: 34 rows
- `history_events`: 1 row
- `history_event_actors`: 1 row
- `history_event_entities`: 1 row
- `history_field_changes`: 1 row
- `history_event_inputs`: 0 rows
- `history_current_values`: 5,813 rows
- `history_nodes`: 5,817 rows
- `history_edges`: 5 rows

Current tracked values are concentrated in:

- `repair_orders`: 4,860
- `users`: 657
- `admins`: 210
- `permissions`: 83
- `roles`: 3

The seeded permission exists and is attached to Super Admin:

- `history.view`

Legacy repair-order history still exists and is separate:

- `repair_order_change_histories`: 3 rows

## Base URL And Auth

Use the API prefix:

```text
http://localhost:5001/api/v1
```

For Postman:

- Authorization type: `Bearer Token`
- Token: admin JWT
- Required permission: `history.view`

If you open Swagger in a browser, that page is additionally protected by basic auth, but the REST API itself is JWT-based.

## History Endpoints

### 1. Search current tracked values

`GET /history/values/search`

Purpose:

- Search the current-value index by normalized hash.
- Return current occurrences across all tracked entities.

Query params:

- `value` required
- `value_type` optional
- `entity_table` optional
- `field_path` optional
- `limit` optional, default `20`, max `100`
- `offset` optional, default `0`

Important behavior:

- If `value_type` is omitted, the service tries multiple fallback types.
- For `phone`, it also tries Uzbek E.164 normalization.
- Result rows are pulled from `history_current_values`.
- Sensitive values may be masked, omitted, or hash-only depending on tracked-field rules.

Typical response shape:

```json
{
  "rows": [
    {
      "id": "uuid",
      "entity_table": "repair_orders",
      "entity_pk": "uuid",
      "field_path": "phone_category_id",
      "value_type": "reference",
      "value_text": "10000000-0000-4000-8000-000000000008",
      "value_normalized": "10000000-0000-4000-8000-000000000008",
      "value_hash": "sha256...",
      "ref_table": "phone_categories",
      "ref_pk": "10000000-0000-4000-8000-000000000008",
      "ref_label": null,
      "last_change_id": "uuid",
      "current_since": "2026-04-26T07:53:54.940Z",
      "updated_at": "2026-04-26T07:53:54.870Z"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

Recommended tests:

- Search by a reference UUID:

```text
value=10000000-0000-4000-8000-000000000008
value_type=reference
entity_table=repair_orders
field_path=phone_category_id
```

- Search by phone number with `value_type=phone`
- Search by email in lowercase and uppercase
- Search by a repair-order status UUID with `value_type=reference`

Expected failures:

- `400` if `value` is missing or invalid
- `401` if token is missing/invalid
- `403` if user lacks `history.view`

### 2. Explain one current value

`GET /history/values/:current_value_id/lineage`

Purpose:

- Load the current value row.
- Follow the graph backward and forward from the current value node or producing change node.
- Return the producing event, actors, entities, inputs, changes, and graph edges.

Query params:

- `depth` optional, default `4`, min `1`, max `8`

Response shape:

```json
{
  "currentValue": {},
  "producingChange": {},
  "event": {},
  "actors": [],
  "entities": [],
  "inputs": [],
  "changes": [],
  "graph": {
    "nodes": [],
    "edges": []
  }
}
```

What it means:

- `currentValue`: the row from `history_current_values`
- `producingChange`: the last change row behind that current value
- `event`: the history event that created the change
- `actors`: event actors
- `entities`: event entities
- `inputs`: event inputs
- `changes`: all field changes under that event
- `graph`: traversed graph slice around the value

Recommended tests:

- Use a known current-value id from this workspace:

```text
0896bacd-a8d3-4690-a766-dfc67a27c67d
```

- Run with `depth=1`, `depth=4`, and `depth=8`
- Confirm `404` for a random UUID not present in `history_current_values`

### 3. Entity timeline

`GET /history/entities/:table/:id/timeline`

Purpose:

- Fetch the event timeline for a business entity.
- It uses both:
  - `history_event_entities`
  - `history_field_changes`

Query params:

- `limit` optional, default `20`, max `100`
- `offset` optional, default `0`

Response shape:

```json
{
  "rows": [
    {
      "event": {},
      "actors": [],
      "entities": [],
      "inputs": [],
      "changes": []
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

Important behavior:

- This endpoint does not require a UUID for `:id`; it is plain text.
- It returns events where the entity was listed as an entity and events where the entity was changed directly.

Recommended tests:

- `table=repair_orders`
- `id=0c870e5c-9d1d-4ca4-8072-20e33bbdf56f`
- `limit=20`

Expected failures:

- Empty result if the entity has no history
- `400` if `limit` is over `100`

### 4. Event detail

`GET /history/events/:event_id`

Purpose:

- Return one complete event with all attached pieces.
- Also returns the event graph built from the event's edges.

Response shape:

```json
{
  "event": {},
  "actors": [],
  "entities": [],
  "inputs": [],
  "changes": [],
  "graph": {
    "nodes": [],
    "edges": []
  }
}
```

Recommended tests:

- Use a known event id from this workspace:

```text
3b9d64b1-420e-4258-bbbe-2bb95be292da
```

- Confirm `404` for a random UUID not present in `history_events`

## What Writes History Today

The history API is read-only, but several application write paths generate history records.

### Direct history writer

`src/history/history.service.ts`

This service writes to:

- `history_events`
- `history_event_actors`
- `history_event_entities`
- `history_field_changes`
- `history_current_values`
- `history_event_inputs`
- `history_nodes`
- `history_edges`

It is used by repair orders, admin/user/role/auth flows, and the catalog/config writers.

### Catalog and configuration paths that write history

The following modules record global history for create/update/delete, sort changes where applicable, and relationship assignment changes where applicable:

- `src/phone-os-types/phone-os-types.service.ts`
- `src/phone-categories/phone-categories.service.ts`
- `src/problem-categories/problem-categories.service.ts`
- `src/repair-parts/repair-parts.service.ts`
- `src/branches/branches.service.ts`
- `src/repair-order-statuses/repair-order-statuses.service.ts`
- `src/repair-order-reject-causes/repair-order-reject-causes.service.ts`
- `src/repair-order-regions/repair-order-regions.service.ts`
- `src/rental-phone-devices/rental-phone-devices.service.ts`

Branch creation also records the protected default repair-order statuses created for that branch.

### Repair-order paths that write history

`src/repair-orders/services/repair-order-change-logger.service.ts`

- Creates a legacy `repair_order_change_histories` row.
- Then creates a global history event with one actor, one primary entity, and one field change.

`src/repair-orders/repair-orders.service.ts`

- `create`
- `update`
- `move`
- `updateSort`
- `softDelete`
- `updateClientInfo`
- `updateProduct`
- `updateProblem`
- `transferBranch`

These are the main flows that call the change logger.

`src/repair-orders/services/assign-admin-updater.service.ts`

- `POST /repair-orders/:repair_order_id/assign-admins`
- `DELETE /repair-orders/:repair_order_id/assign-admins/:admin_id`
- `DELETE /repair-orders/:repair_order_id/assign-admins`

Writes history around `admin_ids`.

`src/repair-orders/services/comment-updater.service.ts`

- `POST /repair-orders/:repair_order_id/comments`
- `PATCH /comments/:comment_id`
- `DELETE /comments/:comment_id`

Writes history around `comments`.

`src/repair-orders/services/pickup-updater.service.ts`

- `POST /repair-orders/:repair_order_id/pickup`
- `PATCH /repair-orders/:repair_order_id/pickup/:pickup_id`
- `DELETE /repair-orders/:repair_order_id/pickup/:pickup_id`

Writes history around `pickup`.

`src/repair-orders/services/delivery-updater.service.ts`

- `POST /repair-orders/:repair_order_id/delivery`
- `PATCH /repair-orders/:repair_order_id/delivery/:delivery_id`
- `DELETE /repair-orders/:repair_order_id/delivery/:delivery_id`

Writes history around `delivery`.

`src/repair-orders/services/rental-phone-updater.service.ts`

- `POST /repair-orders/:repair_order_id/rental-phone`
- `PATCH /repair-orders/:repair_order_id/rental-phone`
- `DELETE /repair-orders/:repair_order_id/rental-phone`
- `PATCH /repair-orders/:repair_order_id/rental-phone/:rental_phone_id`
- `DELETE /repair-orders/:repair_order_id/rental-phone/:rental_phone_id`

Writes history around `rental_phone`.

`src/repair-orders/services/initial-problem-updater.service.ts`

- `initial_problems`

`src/repair-orders/services/final-problem-updater.service.ts`

- `final_problems`

`src/repair-orders/services/attachments.service.ts`

- `POST /repair-orders/:repair_order_id/attachments`
- `DELETE /repair-orders/:repair_order_id/attachments/:attachment_id`

Writes history via `attachment_uploaded` and `attachment_deleted`.

### OnlinePBX webhook path

`src/online-pbx/online-pbx.service.ts`

- `POST /api/webhooks/online-pbx/webhook`
- Writes a global history event with `source_type = webhook` and `source_name = online-pbx`.
- Tracks the `phone_calls` upsert and links the event to the affected `repair_orders` and `users` rows when they are resolved.
- Captures scalar webhook inputs such as `uuid`, `event`, `direction`, durations, and masked phone/admin-code evidence.

### What does not write history

`src/repair-orders/services/service-forms.service.ts`

- Creates and deletes `service_forms`
- Does not call the history logger

## Suggested Postman Collection Structure

Create one collection with these folders:

### Folder: History

Requests:

1. `Search current values`
2. `Value lineage`
3. `Entity timeline`
4. `Event detail`

### Folder: Repair Order Writers

Requests:

1. `Create repair order`
2. `Update repair order`
3. `Move repair order`
4. `Update sort`
5. `Soft delete repair order`
6. `Update client info`
7. `Update product`
8. `Update problem`
9. `Transfer branch`
10. `Assign admins`
11. `Add comment`
12. `Update comment`
13. `Delete comment`
14. `Create pickup`
15. `Update pickup`
16. `Delete pickup`
17. `Create delivery`
18. `Update delivery`
19. `Delete delivery`
20. `Create rental phone`
21. `Update rental phone`
22. `Delete rental phone`
23. `Upload attachment`
24. `Delete attachment`

## Practical Test Flow

Use this order if you want to prove the whole system works.

### Step 1. Confirm auth

- Send a request to any history endpoint with a valid admin JWT.
- If you get `403`, the admin does not have `history.view`.

### Step 2. Search an existing current value

Example:

```text
GET /api/v1/history/values/search?value=10000000-0000-4000-8000-000000000008&value_type=reference&entity_table=repair_orders&field_path=phone_category_id
```

Expected:

- One or more rows
- Total matches the rows returned

### Step 3. Inspect the value lineage

Use the `id` from the search result:

```text
GET /api/v1/history/values/0896bacd-a8d3-4690-a766-dfc67a27c67d/lineage?depth=4
```

Expected:

- Current value
- Producing change
- Related event
- Actor list
- Entity list
- Graph edges

### Step 4. Inspect the entity timeline

```text
GET /api/v1/history/entities/repair_orders/0c870e5c-9d1d-4ca4-8072-20e33bbdf56f/timeline?limit=20&offset=0
```

Expected:

- A timeline of events involving that repair order

### Step 5. Inspect the event detail

```text
GET /api/v1/history/events/3b9d64b1-420e-4258-bbbe-2bb95be292da
```

Expected:

- Full event payload
- Graph nodes and edges

### Step 6. Generate a new event from a repair-order mutation

Pick one mutation path, for example:

- `PATCH /api/v1/repair-orders/:repair_order_id/client`
- `PATCH /api/v1/repair-orders/:repair_order_id/product`
- `PATCH /api/v1/repair-orders/:repair_order_id/move`
- `POST /api/v1/repair-orders/:repair_order_id/comments`

Then re-run:

- `search`
- `lineage`
- `timeline`
- `event detail`

This confirms the writer and reader are connected.

## Validation Rules To Remember

- `current_value_id` and `event_id` must be UUIDs.
- `depth` max is `8`.
- `limit` max is `100`.
- `offset` must be zero or greater.
- `value` max length is `500`.
- `entity_table` max length is `120`.
- `field_path` max length is `240`.

## Notes About The Existing Database Design

- The new history schema is append-only and separate from the legacy repair-order timeline.
- `history_current_values` is already heavily populated from a backfill or existing write path.
- `history_event_inputs` is currently empty in this database snapshot.
- `history_tracked_fields` already includes repair-order, user, admin, permission, and role fields.
- Sensitive values use `mask`, `hash_only`, or `omit` depending on the tracked-field configuration.

## Useful Local Sample IDs

These were present in the live local database when this guide was written:

- `history_events.id`: `3b9d64b1-420e-4258-bbbe-2bb95be292da`
- `history_current_values.id`: `0896bacd-a8d3-4690-a766-dfc67a27c67d`
- `repair_orders.id`: `0c870e5c-9d1d-4ca4-8072-20e33bbdf56f`

If the local DB changes, replace them with fresh IDs from the search and timeline endpoints.
