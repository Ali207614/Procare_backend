# History Tracking Schema Design

## Goal

Build a system-wide, always-on history layer that can answer:

- Where does this current database value live?
- Which action wrote it?
- Which actor, job, webhook, or system process caused it?
- Which earlier values, entities, permissions, workflow rules, or external inputs led to it?
- Which entities were affected by the action?

This is stronger than a normal audit log. It is a lineage graph for database values.

## Current Schema Shape

The current database is centered around these domains:

- Identity and access: `admins`, `users`, `roles`, `permissions`, `admin_roles`, `role_permissions`, `admin_branches`.
- Branch and catalogs: `branches`, `phone_os_types`, `phone_categories`, `problem_categories`, `repair_parts`, `repair_part_assignments`, `phone_problem_mappings`, `repair_order_regions`, `repair_order_reject_causes`.
- Repair order workflow: `repair_orders`, `repair_order_statuses`, `repair-order-status-transitions`, `repair_order_status_permissions`.
- Repair order children: assigned admins, initial/final problems, parts, payments, comments, pickups, deliveries, attachments, service forms, rental phones, phone calls.
- Marketing and communication: `templates`, `template_histories`, `campaigns`, `campaign_recipient`, `notifications`, `offers`, `user_offer_acceptances`, `app_features`.

Important schema traits:

- Most tables use `uuid` primary keys, but not all. `user_phone_category_assignment` uses an integer id.
- Many child tables cascade when a parent is deleted. This is fine for business data, but bad for permanent audit history.
- Current actor columns are mostly `created_by`, `updated_by`, `uploaded_by`, or `admin_id`; they assume an admin actor and do not model users, webhooks, cron jobs, or system actions consistently.
- Status/workflow logic has many rule tables: status permissions, transitions, reject cause gates, agreed date gates, service form gates, region permissions, and role permissions.
- Existing migrations already use `jsonb` in multiple business tables: `admins.work_days`, `repair_order_change_histories.old_value/new_value`, `notifications.meta`, `templates.variables`, `template_histories.variables`, `campaigns.filters`, `campaigns.ab_test`, and several `service_forms` columns.

For the new history tables, do not use `jsonb`. Store values as typed scalar rows.

## Why Existing History Is Not Enough

`repair_order_change_histories` is useful as a repair-order timeline, but it is not suitable as the new foundation:

- It only works for repair orders.
- It stores `old_value` and `new_value` as `jsonb`.
- It requires `created_by` to be an admin.
- It cascades on `repair_order_id`, so deleting a repair order deletes its history.
- It has no request context, no external source, no causal links, no affected entity list, and no global value search index.
- It has no indexes for high-volume history queries.

`template_histories` is also not audit history. It is version history, uses `jsonb`, cascades on template delete, and the service keeps only the newest five versions.

## Design Principles

1. Audit tables must be append-only.
2. Audit tables must not cascade-delete from operational tables because operational rows disappear. Cascades inside the history subsystem are acceptable only for tightly owned child rows.
3. Do not foreign-key audit actors/entities to mutable business tables unless the foreign key is optional and denormalized labels are also stored.
4. Store every changed value as a scalar row: text value, normalized value, type, hash, and optional reference information.
5. Separate "what changed" from "why it changed".
6. Model lineage as a graph, not only as a flat event list.
7. Every history write should happen in the same transaction as the business write.
8. For high volume, partition by time and index by value hash, entity, actor, and event time.

## Proposed Tables

### 0. `history_tracked_fields`

Metadata for every table/field that the history layer tracks. This gives the writer and endpoints one place to learn how a value should be normalized, redacted, searched, and displayed.

```sql
CREATE TABLE history_tracked_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  entity_table varchar(120) NOT NULL,
  field_path varchar(240) NOT NULL,
  value_type varchar(40) NOT NULL,

  is_active boolean NOT NULL DEFAULT true,
  is_sensitive boolean NOT NULL DEFAULT false,
  track_current_value boolean NOT NULL DEFAULT true,
  capture_old_value boolean NOT NULL DEFAULT true,
  capture_new_value boolean NOT NULL DEFAULT true,

  ref_table varchar(120),
  normalizer_key varchar(80),
  redaction_strategy varchar(40) NOT NULL DEFAULT 'none',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (entity_table, field_path),
  CHECK (redaction_strategy IN ('none', 'mask', 'hash_only', 'omit'))
);
```

Examples:

- `repair_orders.phone_number`: `value_type = 'phone'`, `normalizer_key = 'uz_phone_e164'`, `is_sensitive = true`, `redaction_strategy = 'mask'`.
- `repair_orders.status_id`: `value_type = 'reference'`, `ref_table = 'repair_order_statuses'`.
- `admins.password`: `is_sensitive = true`, `redaction_strategy = 'hash_only'` or `omit`.
- `admins.work_days.monday`: scalar path tracked separately even though the current business column is `jsonb`.

### 1. `history_events`

One row per logical action. This is the root of an audit event.

```sql
CREATE TABLE history_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),

  action_key varchar(160) NOT NULL,
  action_kind varchar(40) NOT NULL,
  source_type varchar(40) NOT NULL,
  source_name varchar(160),

  request_id varchar(120),
  correlation_id varchar(120),
  idempotency_key varchar(160),

  http_method varchar(12),
  http_path text,
  ip_address inet,
  user_agent text,

  ip_country_code varchar(2),
  ip_country_name varchar(120),
  ip_region text,
  ip_city text,
  ip_latitude numeric(9,6),
  ip_longitude numeric(9,6),
  ip_timezone varchar(80),
  ip_isp text,
  ip_org text,
  ip_asn varchar(40),
  ip_is_vpn boolean,
  ip_is_proxy boolean,
  ip_is_tor boolean,
  ip_geo_provider varchar(80),
  ip_geo_confidence numeric(5,4),
  ip_geo_resolved_at timestamptz,

  root_entity_table varchar(120),
  root_entity_pk text,
  branch_id text,

  is_success boolean NOT NULL DEFAULT true,
  failure_code varchar(120),
  failure_message text,

  previous_event_hash char(64),
  event_hash char(64),
  created_at timestamptz NOT NULL DEFAULT now(),

  CHECK (action_kind IN ('create', 'update', 'delete', 'link', 'unlink', 'move', 'login', 'logout', 'sync', 'job', 'webhook', 'read_sensitive', 'other')),
  CHECK (source_type IN ('admin_api', 'user_api', 'system_job', 'cron', 'webhook', 'seed', 'script', 'migration', 'integration', 'unknown'))
);
```

Notes:

- `event_hash` is optional but recommended for tamper evidence.
- `root_entity_table/root_entity_pk` gives fast grouping, for example a repair order and all child changes.
- No FK to business tables. Preserve the evidence even if business rows are later deleted.
- `ip_address` and `user_agent` are request context for the event, not current properties of an admin or user.
- IP geolocation fields are evidence enrichment. They can help answer "this admin/user caused this event, from this IP, approximately from this country/city/ISP", but they are not exact device GPS location and can be wrong when VPNs, proxies, mobile carrier NAT, corporate networks, or datacenter IPs are involved.
- Capture `ip_address` synchronously during the request. Resolve geolocation asynchronously after the history event is written so audit writes do not depend on a third-party geo provider.

### 2. `history_event_actors`

One event can have more than one actor: initiator, executor, system job, external source.

```sql
CREATE TABLE history_event_actors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES history_events(id) ON DELETE CASCADE,

  actor_role varchar(40) NOT NULL,
  actor_type varchar(40) NOT NULL,
  actor_table varchar(120),
  actor_pk text,
  actor_label text,

  auth_subject text,
  permission_name text,

  CHECK (actor_role IN ('initiator', 'executor', 'approver', 'system', 'external_source', 'impersonated_by')),
  CHECK (actor_type IN ('admin', 'user', 'system', 'cron', 'webhook', 'integration', 'script', 'migration', 'unknown'))
);
```

This is the "guilty" side of the endpoint. It can tell whether a value came from a specific admin, user, cron job, webhook, script, or migration.

### 3. `history_event_entities`

All entities involved in an event: direct target, affected rows, read dependencies, permissions used, workflow rules used, generated outputs.

```sql
CREATE TABLE history_event_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES history_events(id) ON DELETE CASCADE,

  entity_table varchar(120) NOT NULL,
  entity_pk text NOT NULL,
  entity_label text,
  entity_role varchar(50) NOT NULL,

  root_entity_table varchar(120),
  root_entity_pk text,
  branch_id text,

  before_exists boolean,
  after_exists boolean,
  created_at timestamptz NOT NULL DEFAULT now(),

  CHECK (entity_role IN (
    'primary_target',
    'created',
    'updated',
    'deleted',
    'linked',
    'unlinked',
    'affected',
    'victim',
    'read_dependency',
    'permission_dependency',
    'workflow_dependency',
    'external_reference',
    'notification_target',
    'derived_output'
  ))
);
```

This is the "victims" table. For example:

- A status-permission edit can list all admins or repair orders affected by the rule change.
- A campaign send can list recipients as `notification_target`.
- A repair order status move can list the status transition row and status permission row as dependencies.

### 4. `history_field_changes`

One row per changed field or field path.

```sql
CREATE TABLE history_field_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES history_events(id) ON DELETE CASCADE,
  event_entity_id uuid REFERENCES history_event_entities(id) ON DELETE SET NULL,

  entity_table varchar(120) NOT NULL,
  entity_pk text NOT NULL,
  field_path varchar(240) NOT NULL,
  operation varchar(30) NOT NULL,

  value_type varchar(40) NOT NULL,

  old_value_text text,
  old_value_normalized text,
  old_value_hash char(64),
  old_ref_table varchar(120),
  old_ref_pk text,
  old_ref_label text,

  new_value_text text,
  new_value_normalized text,
  new_value_hash char(64),
  new_ref_table varchar(120),
  new_ref_pk text,
  new_ref_label text,

  is_sensitive boolean NOT NULL DEFAULT false,
  changed_at timestamptz NOT NULL DEFAULT now(),

  CHECK (operation IN ('insert', 'update', 'delete', 'link', 'unlink', 'touch')),
  CHECK (value_type IN ('null', 'string', 'text', 'uuid', 'integer', 'decimal', 'money', 'boolean', 'date', 'timestamp', 'enum', 'phone', 'email', 'url', 'file', 'reference'))
);
```

Examples:

- `repair_orders.status_id`: `value_type = 'reference'`, `new_ref_table = 'repair_order_statuses'`, `new_ref_pk = status id`, `new_ref_label = status name`.
- `repair_orders.phone_number`: `value_type = 'phone'`, normalized to E.164 in `new_value_normalized`.
- `admins.work_days.monday`: `value_type = 'boolean'`. Even though the business column is currently `jsonb`, history stores the path as scalar rows.
- `campaigns.filters.branch_id`: `value_type = 'reference'`. Store one scalar row per filter key.

### 5. `history_current_values`

Fast index of values that currently exist in tracked business tables.

```sql
CREATE TABLE history_current_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  entity_table varchar(120) NOT NULL,
  entity_pk text NOT NULL,
  field_path varchar(240) NOT NULL,

  value_type varchar(40) NOT NULL,
  value_text text,
  value_normalized text,
  value_hash char(64),

  ref_table varchar(120),
  ref_pk text,
  ref_label text,

  last_change_id uuid REFERENCES history_field_changes(id) ON DELETE SET NULL,
  current_since timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (entity_table, entity_pk, field_path)
);
```

This table powers the endpoint where the user gives a value. The endpoint hashes the normalized input, finds all current occurrences, then follows `last_change_id` into the lineage graph.

### 6. `history_event_inputs`

Scalar evidence captured from requests, jobs, webhooks, and scripts.

```sql
CREATE TABLE history_event_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES history_events(id) ON DELETE CASCADE,

  input_key varchar(240) NOT NULL,
  value_type varchar(40) NOT NULL,
  value_text text,
  value_normalized text,
  value_hash char(64),
  is_sensitive boolean NOT NULL DEFAULT false,

  ref_table varchar(120),
  ref_pk text,
  ref_label text
);
```

This replaces the temptation to store a request body as `jsonb`. Decompose payloads into key-value rows. For very large payloads, store only a hash and file/object-storage pointer in `value_text`.

### 7. `history_nodes`

Uniform graph nodes for events, actors, entities, changes, current values, and inputs.

```sql
CREATE TABLE history_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_type varchar(40) NOT NULL,
  label text,

  event_id uuid REFERENCES history_events(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES history_event_actors(id) ON DELETE CASCADE,
  event_entity_id uuid REFERENCES history_event_entities(id) ON DELETE CASCADE,
  field_change_id uuid REFERENCES history_field_changes(id) ON DELETE CASCADE,
  current_value_id uuid REFERENCES history_current_values(id) ON DELETE CASCADE,
  event_input_id uuid REFERENCES history_event_inputs(id) ON DELETE CASCADE,

  created_at timestamptz NOT NULL DEFAULT now(),

  CHECK (node_type IN ('event', 'actor', 'entity', 'field_change', 'current_value', 'event_input'))
);
```

### 8. `history_edges`

Directed graph edges. This is what makes "show the entire path" practical.

```sql
CREATE TABLE history_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  from_node_id uuid NOT NULL REFERENCES history_nodes(id) ON DELETE CASCADE,
  to_node_id uuid NOT NULL REFERENCES history_nodes(id) ON DELETE CASCADE,
  edge_type varchar(60) NOT NULL,

  event_id uuid REFERENCES history_events(id) ON DELETE SET NULL,
  confidence numeric(5,4) NOT NULL DEFAULT 1,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),

  CHECK (edge_type IN (
    'initiated',
    'executed',
    'changed',
    'created',
    'deleted',
    'linked',
    'unlinked',
    'replaced',
    'derived_from',
    'allowed_by',
    'blocked_by',
    'read_from',
    'affected',
    'notified',
    'current_value_of'
  ))
);
```

Example path:

`admin actor -> initiated -> event -> changed -> repair_orders.status_id change -> derived_from -> webhook input`

and:

`repair_orders.status_id change -> allowed_by -> repair-order-status-transitions row`

and:

`repair_orders.status_id change -> affected -> notification row`

## Required Indexes

```sql
CREATE INDEX history_events_time_idx
  ON history_events (occurred_at DESC);

CREATE INDEX history_tracked_fields_active_idx
  ON history_tracked_fields (entity_table, is_active);

CREATE INDEX history_events_actor_lookup_idx
  ON history_event_actors (actor_type, actor_pk);

CREATE INDEX history_entities_lookup_idx
  ON history_event_entities (entity_table, entity_pk, event_id);

CREATE INDEX history_entities_role_idx
  ON history_event_entities (entity_role, entity_table);

CREATE INDEX history_changes_entity_field_time_idx
  ON history_field_changes (entity_table, entity_pk, field_path, changed_at DESC);

CREATE INDEX history_changes_new_value_idx
  ON history_field_changes (new_value_hash, entity_table, field_path);

CREATE INDEX history_changes_old_value_idx
  ON history_field_changes (old_value_hash, entity_table, field_path);

CREATE INDEX history_current_value_hash_idx
  ON history_current_values (value_hash);

CREATE INDEX history_current_entity_idx
  ON history_current_values (entity_table, entity_pk);

CREATE INDEX history_edges_from_idx
  ON history_edges (from_node_id, edge_type);

CREATE INDEX history_edges_to_idx
  ON history_edges (to_node_id, edge_type);
```

For high volume, partition `history_events`, `history_field_changes`, and possibly `history_edges` by month using `occurred_at` or `changed_at`.

## Endpoint Model

### Search by current value

`GET /history/values/search?value=...`

Flow:

1. Normalize the input value using type-aware rules.
2. Compute SHA-256 hash.
3. Search `history_current_values.value_hash`.
4. Return all current occurrences: table, row id, field, display label, current since, last change id.

### Explain one value

`GET /history/values/:currentValueId/lineage`

Flow:

1. Load the `history_current_values` row.
2. Start from its node or `last_change_id` node.
3. Traverse `history_edges` backward for causes and dependencies.
4. Traverse `history_edges` forward for affected entities.
5. Return a graph with sections:
   - current value
   - producing change
   - action/event
   - actors
   - request IP, user agent, and approximate IP geolocation
   - inputs
   - permission/workflow dependencies
   - affected entities
   - previous values

### Entity timeline

`GET /history/entities/:table/:id/timeline`

Read `history_event_entities` and `history_field_changes` by entity lookup index.

### Event detail

`GET /history/events/:id`

Load event, actors, entities, inputs, changes, and graph edges.

## Write Strategy

Use application-level history writing as the primary method. Database triggers can record raw changes, but they cannot reliably know why a value changed, which permission allowed it, which webhook caused it, or which entities were victims.

Recommended write flow:

1. Open business transaction.
2. Create `history_events` row with request/job context.
3. Insert actors.
4. Snapshot tracked fields before the business write.
5. Execute business write.
6. Snapshot tracked fields after the business write.
7. Insert `history_event_entities`, `history_field_changes`, `history_event_inputs`, nodes, and edges.
8. Upsert `history_current_values`.
9. Commit the transaction.
10. Resolve IP geolocation asynchronously when `ip_address` is present, then update the same `history_events` row with provider, approximate location, ISP/ASN, VPN/proxy/Tor flags, confidence, and `ip_geo_resolved_at`.

Scripts, seeds, migrations, cron jobs, webhooks, and integrations should also create events with `source_type` set correctly.

## Rollout Plan

1. Create the new history tables and indexes.
2. Build a small history writer service that accepts events, actors, entities, inputs, changes, and edges.
3. Backfill `history_current_values` from all current operational tables.
4. Backfill legacy `repair_order_change_histories` into the new tables as best-effort historical events.
5. Instrument the most important write paths first:
   - repair order create/update/status move
   - role and permission changes
   - status permission and transition changes
   - user/admin create/update/delete
   - campaign/template changes
   - rental phone assignment/return
   - webhook and telephony actions
6. Add endpoint support for value search, value lineage, entity timeline, and event detail.
7. Add tests that assert every mutating endpoint writes at least one history event.

## Key Decision

Do not extend `repair_order_change_histories` for this task. Keep it as legacy repair-order timeline data and migrate/backfill from it. The new requirement needs a global, append-only, no-JSONB, graph-capable history model.
