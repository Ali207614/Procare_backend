# Repair Order Analytics Documentation

## Purpose

The repair order analytics module powers three CRM analytics tables:

1. Operator analytics: lead distribution by Operator admin.
2. Source analytics: lead distribution by repair order source.
3. Invalid-status reject-cause analytics: lead loss analysis by reject cause, grouped by the status that existed before the order moved into an Invalid status.

The module is implemented in `src/analytics/` and exposes dynamic, table-oriented responses for frontend rendering. The response is designed around dynamic repair order statuses, because status names, colors, ordering, and branch ownership are configurable data rather than stable code constants.

## UI References

The following Figma frames and supplied product screenshots are the canonical UI references for the analytics tables.

| Product surface | Figma reference | Backend endpoint |
| --- | --- | --- |
| Analytics by operators table | [Procare new, node 3398:32903](https://www.figma.com/design/shWzTh7Hk7ZaKGPI5ouElv/Procare---new?node-id=3398-32903&t=uQIXVU4CbSixJcgE-4) | `GET /api/v1/analytics/repair-orders/by-operators` |
| Analytics by source types table | [Procare new, node 3398:33735](https://www.figma.com/design/shWzTh7Hk7ZaKGPI5ouElv/Procare---new?node-id=3398-33735&t=uQIXVU4CbSixJcgE-4) | `GET /api/v1/analytics/repair-orders/by-sources` |
| Invalid repair order status by reject causes | [Procare new, node 3398:35023](https://www.figma.com/design/shWzTh7Hk7ZaKGPI5ouElv/Procare---new?node-id=3398-35023&t=uQIXVU4CbSixJcgE-4) | `GET /api/v1/analytics/repair-orders/by-reject-causes` |

### Observed UI Contract

All three screens use the same table pattern:

| UI element | Operators table | Sources table | Reject-cause table |
| --- | --- | --- | --- |
| Title | `Operatorlar bo'yicha statistika` | `Manbalar bo'yicha statistika` | `Rad etish sabablari bo'yicha statistika` |
| Date control | Month picker, for example `May, 2026` | Month picker, for example `May, 2026` | Month picker, for example `May, 2026` |
| Main row label column | `Aloqa markazi` | `Manba` | `Rad etish sabablari` |
| Static metric columns | `No.`, group label, `Leadlar`, `Foizi` | `No.`, group label, `Leadlar`, `Foizi` | `No.`, group label, `Leadlar`, `Foizi` |
| Summary row label | `Jami ulush` | `Jami ulush` | `Jami ulush` |
| Dynamic status columns | Status name group header, with `Soni` and `Foizi` subcolumns | Same | Same |

The screenshots show colored status column bands such as:

| Status group header | Visual behavior |
| --- | --- |
| `Yangi buyurtma` | Green-tinted status band |
| `Ko'tarmadi` | Red/pink-tinted status band |
| `O'ylab ko'radi` | Yellow/orange-tinted status band |
| `Uchrashuv belgilandi` | Blue-tinted status band |

The backend supplies the status metadata through `statuses[].color` and `statuses[].bg_color`; the frontend should use these values when available and fall back to its design-system colors when a status has no configured colors.

## Module Ownership

| File | Responsibility |
| --- | --- |
| `src/analytics/analytics.module.ts` | Registers the analytics controller and service, importing `PermissionsModule`. |
| `src/analytics/repair-order-analytics.controller.ts` | Defines the three authenticated analytics endpoints under `analytics/repair-orders`. |
| `src/analytics/repair-order-analytics.service.ts` | Resolves permissions, branch scope, status columns, grouping definitions, SQL aggregation, and response mapping. |
| `src/analytics/dto/repair-order-analytics-query.dto.ts` | Validates and documents supported query parameters. |
| `src/analytics/types/repair-order-analytics.types.ts` | Defines the stable TypeScript response contract. |

## Authentication and Permissions

All endpoints require:

- A valid admin bearer token through `JwtAdminAuthGuard`.
- At least one of these permissions through `PermissionsGuard`:
  - `analytics.repair_orders.view`
  - `analytics.repair_orders.view_all`

Branch visibility is resolved after the guard passes:

| Admin capability | Branch scope behavior |
| --- | --- |
| Super Admin role | Can query all open, active branches. |
| `analytics.repair_orders.view_all` permission | Can query all open, active branches. |
| Only scoped analytics access | Can query only branches where the admin is assigned through `admin_branches` and at least one of the admin's roles has `repair_order_status_permissions.can_view = true`. |

When `branch_ids` is omitted:

- Super Admin and `view_all` admins receive all open, active branches.
- Scoped admins receive only their viewable open, active branches.

When `branch_ids` is provided:

- Super Admin and `view_all` admins can request any open, active branch.
- Scoped admins can request only branches inside their resolved viewable branch set.

## Endpoints

### 1. Analytics by Operators

```http
GET /api/v1/analytics/repair-orders/by-operators
```

Groups matching repair orders by the latest assigned admin who has an active `Operator` role.

Important semantics:

- Orders without an Operator assignment are excluded from this table.
- If a repair order has multiple assigned Operator admins, the latest assignment wins, ordered by assignment `created_at DESC`, then assignment `id DESC`.
- Operator labels use `first_name + last_name`; missing names are returned as `Nomsiz operator`.
- Operator definitions are filtered by selected branch scope for scoped users or when `branch_ids` is explicitly supplied.

### 2. Analytics by Sources

```http
GET /api/v1/analytics/repair-orders/by-sources
```

Groups matching repair orders by `repair_orders.source`.

Supported source groups come from `REPAIR_ORDER_SOURCES`:

```ts
[
  'Telegram',
  'Meta',
  'Qolda',
  'Boshqa',
  'Kiruvchi qongiroq',
  'Chiquvchi qongiroq',
  'Organic',
  "Sug'urta",
  'Web',
]
```

The response also includes an `unknown` group labelled `Manba belgilanmagan` for orders whose source is null.

### 3. Invalid Status Analytics by Reject Causes

```http
GET /api/v1/analytics/repair-orders/by-reject-causes
```

Groups repair orders by reject cause, but only for repair orders that moved into a repair order status whose `repair_order_statuses.type = 'Invalid'`.

This endpoint has special semantics:

- It always uses status transition history, regardless of the requested `date_field` and `updated_scope`.
- The date range is applied to `repair_order_change_histories.created_at`.
- A repair order is included only if its latest Invalid transition inside the period is found.
- The dynamic status column metric is the previous status before the Invalid transition, not the Invalid status itself.
- By default, orders without `reject_cause_id` are excluded.
- Set `include_empty_reject_cause=true` to include an `empty` group labelled `Sabab belgilanmagan`.

This matches the product table titled `Rad etish sabablari bo'yicha statistika`: the row explains why orders were rejected, and the status columns explain where those rejected orders came from.

## Query Parameters

All three endpoints use the same query DTO.

| Parameter | Required | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `start_time` | Yes | string | None | Analytics range start. Accepts `YYYY-MM-DD` or a valid date/time string. |
| `end_time` | Yes | string | None | Analytics range end. Date-only values are interpreted as an inclusive calendar day and converted internally to the next exclusive midnight. |
| `branch_ids` | No | string array | Permission-derived branch scope | Branch IDs to include. Repeat the query parameter for multiple values. |
| `status_column_ids` | No | string array | All active statuses in scope | Status IDs to render as dynamic table columns. Repeat the query parameter for multiple values. |
| `date_field` | No | `created_at` or `updated_at` | `created_at` | Chooses the repair-order time field for operator/source snapshot analytics. |
| `updated_scope` | No | `status_transitions` or `all_updates` | `status_transitions` | Only used when `date_field=updated_at` for operator/source analytics. |
| `include_empty_reject_cause` | No | boolean | `false` | Only relevant for reject-cause analytics. Includes orders without a reject cause when `true`. |

Array parameters are converted to arrays by wrapping repeated query values. They are not comma-split. Prefer this shape:

```http
?branch_ids=<branch-id-1>&branch_ids=<branch-id-2>&status_column_ids=<status-id-1>&status_column_ids=<status-id-2>
```

Do not send this shape unless the frontend explicitly transforms it before the request:

```http
?branch_ids=<branch-id-1>,<branch-id-2>
```

### Date Range Rules

Date-only input is interpreted in server-local date construction before being returned as ISO strings.

| Input | Internal meaning |
| --- | --- |
| `start_time=2026-05-01` | Start at local `2026-05-01 00:00:00.000`. |
| `end_time=2026-05-31` | Include the full local day of May 31 by converting to exclusive local `2026-06-01 00:00:00.000`. |
| ISO timestamp | Parsed with JavaScript `Date`. The exact timestamp is used. |

The service rejects ranges where `start_time >= end_time`.

For a month picker like `May, 2026`, the recommended request is:

```http
?start_time=2026-05-01&end_time=2026-05-31
```

## Date Semantics by Mode

Operator and source analytics can run in three practical modes.

| Query mode | Date filter | Status metric source | Meaning |
| --- | --- | --- | --- |
| `date_field=created_at` | `repair_orders.created_at` | Current `repair_orders.status_id` | Orders created in the period, grouped by current status. |
| `date_field=updated_at&updated_scope=all_updates` | `repair_orders.updated_at` | Current `repair_orders.status_id` | Orders updated in the period for any reason, grouped by current status. |
| `date_field=updated_at&updated_scope=status_transitions` | `repair_order_change_histories.created_at` where `field='status_id'` | Latest status transition `new_value` inside the period | Orders whose status changed in the period, grouped by the latest status they changed into during that period. |

Reject-cause analytics always behaves like a specialized status-transition report:

| Endpoint | Date filter | Status metric source | Meaning |
| --- | --- | --- | --- |
| `by-reject-causes` | `repair_order_change_histories.created_at` where `field='status_id'` and new status type is `Invalid` | Transition `old_value` from the latest Invalid transition inside the period | Orders that became Invalid, grouped by reject cause and by the status they had before rejection. |

## Response Shape

All endpoints return the same high-level schema.

```ts
type RepairOrderAnalyticsResponse = {
  meta: {
    group_by: 'operator' | 'source' | 'reject_cause';
    generated_at: string;
    date: {
      start_time: string;
      end_time: string;
      date_field: 'created_at' | 'updated_at';
      updated_scope?: 'status_transitions' | 'all_updates';
    };
    filters: {
      branch_ids: string[];
      status_column_ids?: string[];
    };
  };

  statuses: RepairOrderAnalyticsStatus[];
  summary: RepairOrderAnalyticsSummary;
  rows: RepairOrderAnalyticsRow[];
};
```

### `statuses`

The `statuses` array defines the dynamic table columns.

```ts
type RepairOrderAnalyticsStatus = {
  id: string;
  name_uz: string;
  name_ru: string;
  name_en: string;
  color: string | null;
  bg_color: string | null;
  sort: number;
  is_active: boolean;
  branch_id: string;
};
```

Rendering guidance:

- Use `status.id` as the stable lookup key.
- Display the localized name for the active frontend locale.
- Use `sort` for status column order as returned by the backend.
- Use `color` and `bg_color` for the status band if present.
- Do not hardcode columns like `new_order`, `not_answered`, or status names; statuses are branch-owned data.

### `summary`

The summary row represents the UI row labelled `Jami ulush`.

```ts
type RepairOrderAnalyticsSummary = {
  label: 'Jami ulush';
  leads: {
    count: number;
    percent_of_total: number;
  };
  status_metrics: Record<string, {
    status_id: string;
    count: number;
    percent_of_total: number;
  }>;
};
```

The summary `leads.percent_of_total` is `100` when there is at least one lead and `0` when there are no matching leads.

### `rows`

Each row maps to one table body row.

```ts
type RepairOrderAnalyticsRow = {
  index: number;
  group: {
    id: string | null;
    key: string;
    label: string;
    type: 'operator' | 'source' | 'reject_cause';
  };
  leads: {
    count: number;
    percent_of_total: number;
  };
  status_metrics: Record<string, {
    status_id: string;
    count: number;
    percent_of_group: number;
    percent_of_total: number;
  }>;
};
```

Row sorting is deterministic:

1. Higher `leads.count` first.
2. Then lower configured group `sort`.
3. Then alphabetical `group.label`.

## Important Metric Rules

### `Leadlar`

`Leadlar` is the total count for the row after the selected endpoint, date mode, branch scope, and grouping rules are applied.

For operator analytics, this means `Leadlar` counts only orders that have a qualifying Operator assignment.

For source analytics, this means `Leadlar` counts matching repair orders by current source.

For reject-cause analytics, this means `Leadlar` counts orders that moved into an Invalid status during the selected period and match the reject-cause filter.

### Main `Foizi`

The main row percentage is:

```txt
row.leads.count / summary.leads.count * 100
```

The backend rounds to two decimal places.

### Status `Soni`

For each dynamic status column, `Soni` is:

```txt
row.status_metrics[status.id].count
```

If no orders match the row/status pair, the backend returns a zero-valued metric for that status ID.

### Status `Foizi`

For each row/status pair, use:

```txt
row.status_metrics[status.id].percent_of_group
```

This matches the UI pattern where every dynamic status has its own `Soni` and `Foizi` subcolumns.

### Status Column Filters Do Not Change `Leadlar`

`status_column_ids` controls which status columns are rendered. It does not filter the base lead total.

Example:

- A row has 100 total matching leads.
- `status_column_ids` includes only two status IDs.
- `row.leads.count` remains 100.
- `row.status_metrics` contains metrics only for the selected visible statuses.

This is intentional because the UI table separates total lead share from selected status-column breakdown.

## Example Requests

### Operators, Month View

```http
GET /api/v1/analytics/repair-orders/by-operators?start_time=2026-05-01&end_time=2026-05-31
Authorization: Bearer <admin-token>
```

### Sources, Selected Branches and Status Columns

```http
GET /api/v1/analytics/repair-orders/by-sources
  ?start_time=2026-05-01
  &end_time=2026-05-31
  &branch_ids=11111111-1111-4111-8111-111111111111
  &branch_ids=22222222-2222-4222-8222-222222222222
  &status_column_ids=33333333-3333-4333-8333-333333333333
  &status_column_ids=44444444-4444-4444-8444-444444444444
Authorization: Bearer <admin-token>
```

### Operators by Status Transitions

```http
GET /api/v1/analytics/repair-orders/by-operators
  ?start_time=2026-05-01
  &end_time=2026-05-31
  &date_field=updated_at
  &updated_scope=status_transitions
Authorization: Bearer <admin-token>
```

This counts each repair order at most once, using its latest status transition inside May 2026.

### Reject Causes Including Empty Causes

```http
GET /api/v1/analytics/repair-orders/by-reject-causes
  ?start_time=2026-05-01
  &end_time=2026-05-31
  &include_empty_reject_cause=true
Authorization: Bearer <admin-token>
```

## Example Response

This example is shortened. Real IDs are UUIDs from `repair_order_statuses`, `admins`, and `repair_order_reject_causes`.

```json
{
  "meta": {
    "group_by": "source",
    "generated_at": "2026-05-18T10:00:00.000Z",
    "date": {
      "start_time": "2026-04-30T19:00:00.000Z",
      "end_time": "2026-05-31T19:00:00.000Z",
      "date_field": "created_at"
    },
    "filters": {
      "branch_ids": [
        "11111111-1111-4111-8111-111111111111"
      ]
    }
  },
  "statuses": [
    {
      "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "name_uz": "Yangi buyurtma",
      "name_ru": "New order",
      "name_en": "New order",
      "color": "#166534",
      "bg_color": "#DCFCE7",
      "sort": 1,
      "is_active": true,
      "branch_id": "11111111-1111-4111-8111-111111111111"
    }
  ],
  "summary": {
    "label": "Jami ulush",
    "leads": {
      "count": 8703,
      "percent_of_total": 100
    },
    "status_metrics": {
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa": {
        "status_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "count": 8201,
        "percent_of_total": 94.23
      }
    }
  },
  "rows": [
    {
      "index": 1,
      "group": {
        "id": null,
        "key": "Telegram",
        "label": "Telegram",
        "type": "source"
      },
      "leads": {
        "count": 5254,
        "percent_of_total": 60.36
      },
      "status_metrics": {
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa": {
          "status_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          "count": 4938,
          "percent_of_group": 93.99,
          "percent_of_total": 56.74
        }
      }
    }
  ]
}
```

## Frontend Rendering Guide

### Table Header

Build the table in two header rows:

1. Static columns:
   - `No.`
   - Context label: `Aloqa markazi`, `Manba`, or `Rad etish sabablari`
   - `Leadlar`
   - `Foizi`
2. Dynamic status groups:
   - One grouped header per `statuses[]`.
   - Each status group spans `Soni` and `Foizi`.

### Summary Row

Render `summary` before `rows`.

Mapping:

| UI cell | Response field |
| --- | --- |
| Group label | `summary.label` |
| Lead count | `summary.leads.count` |
| Main percentage | `summary.leads.percent_of_total` |
| Status count | `summary.status_metrics[status.id].count` |
| Status percentage | `summary.status_metrics[status.id].percent_of_total` |

### Body Rows

Mapping:

| UI cell | Response field |
| --- | --- |
| No. | `row.index` |
| Group label | `row.group.label` |
| Lead count | `row.leads.count` |
| Main percentage | `row.leads.percent_of_total` |
| Status count | `row.status_metrics[status.id].count` |
| Status percentage | `row.status_metrics[status.id].percent_of_group` |

### Formatting

Recommended formatting:

- Format counts with localized thousands separators.
- Format percentages with two fraction digits and the `%` sign.
- Keep percentages numeric in the app state; format only at the display boundary.
- Prefer `Intl.NumberFormat` for locale-aware display.

Example:

```ts
const countFormatter = new Intl.NumberFormat('uz-UZ');
const percentFormatter = new Intl.NumberFormat('uz-UZ', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const countText = countFormatter.format(metric.count);
const percentText = `${percentFormatter.format(metric.percent_of_group)}%`;
```

## Backend Query Strategy

The service follows the same response-building sequence for each endpoint:

1. Resolve and validate the date range.
2. Resolve branch scope from permissions and requested branch filters.
3. Resolve status metadata for dynamic columns.
4. Resolve group definitions for the selected grouping.
5. Fetch grouped counts with SQL.
6. Map counts into a complete table response with summary, rows, status metrics, and percentages.

### Snapshot Counts

Snapshot counts are used when:

- `date_field=created_at`
- `date_field=updated_at&updated_scope=all_updates`

They read from `repair_orders` and use the current `status_id`.

### Status Transition Counts

Status transition counts are used for operator/source analytics when:

```http
date_field=updated_at&updated_scope=status_transitions
```

They read from `repair_order_change_histories` where `field = 'status_id'`, choose the latest status change per repair order inside the range, and count the `new_value` status.

### Invalid Transition Counts

Invalid transition counts are used only by `by-reject-causes`.

They read from `repair_order_change_histories`, join the transition's `new_value` to `repair_order_statuses`, require `repair_order_statuses.type = 'Invalid'`, choose the latest Invalid transition per repair order inside the range, and count the transition's `old_value` as the metric status.

## Data Sources

| Data source | Usage |
| --- | --- |
| `repair_orders` | Base repair order rows, branch filtering, current status, current source, current reject cause, deletion filter. |
| `repair_order_statuses` | Dynamic status column metadata and Invalid-status detection. |
| `repair_order_change_histories` | Status-transition analytics and Invalid transition analytics. |
| `repair_order_assign_admins` | Latest Operator assignment per repair order. |
| `admins`, `admin_roles`, `roles` | Operator group definitions and Operator assignment validation. |
| `branches`, `admin_branches`, `repair_order_status_permissions` | Branch access scope. |
| `repair_order_reject_causes` | Reject-cause group definitions and labels. |

## Performance and Indexes

Analytics support is installed by `migrations/20260514100000_add_repair_order_analytics_permissions_and_indexes.js`.

The migration creates:

| Index | Purpose |
| --- | --- |
| `repair_orders_analytics_created_idx` on `(branch_id, created_at)` where not deleted | Fast created-at snapshot filters. |
| `repair_orders_analytics_updated_idx` on `(branch_id, updated_at)` where not deleted | Fast updated-at snapshot filters. |
| `repair_orders_analytics_status_idx` on `(branch_id, status_id)` where not deleted | Status grouping support. |
| `repair_orders_analytics_source_idx` on `(source)` where not deleted | Source grouping support. |
| `repair_orders_analytics_reject_cause_idx` on `(reject_cause_id)` where not deleted | Reject-cause grouping support. |
| `repair_order_histories_status_transition_idx` on `(created_at, repair_order_id)` where `field='status_id'` | Status transition range scans. |
| `repair_order_histories_status_new_value_idx` on `(new_value #>> '{}')` where `field='status_id'` | Invalid-status transition lookup support. |
| `repair_order_assign_admins_order_created_idx` on `(repair_order_id, created_at DESC)` | Latest operator assignment lookup. |

## Error Behavior

| Condition | Status | Response details |
| --- | --- | --- |
| Missing `start_time` or `end_time` | `400 Bad Request` | `location` is the missing field. |
| Invalid date string | `400 Bad Request` | Message says the boundary must be a valid date or ISO timestamp. |
| `start_time >= end_time` | `400 Bad Request` | `location: date_range`. |
| Invalid or inactive branch requested | `400 Bad Request` | Includes `missing_branch_ids`. |
| Scoped admin requests a denied branch | `403 Forbidden` | Includes `denied_branch_ids`. |
| Scoped admin has no viewable analytics branches | `403 Forbidden` | `location: branch_ids`. |
| Invalid status column for branch scope | `400 Bad Request` | Includes `missing_status_ids`. |

## Known Reporting Caveats

1. Analytics are not historical snapshots of labels.
   - Operator names, source labels, reject-cause names, and status labels are read from current tables.
   - Historical status movement is used only when transition mode is selected.

2. Operator analytics intentionally requires an Operator assignment.
   - Unassigned repair orders are not counted in `by-operators`.
   - If the product needs an "Unassigned" row later, the SQL join should become a left join and a group definition should be added.

3. Source analytics includes all configured source groups even when they have zero leads.
   - Rows are still sorted by total count first, so zero rows appear after active rows.

4. Reject-cause analytics is transition-based.
   - It answers "Which previous statuses produced Invalid orders for each reject cause?"
   - It does not answer "How many current Invalid orders exist by current status?"

5. Multiple transitions inside the same period are collapsed.
   - Operator/source status-transition mode uses the latest status transition per repair order inside the range.
   - Reject-cause mode uses the latest Invalid transition per repair order inside the range.

## Integration Checklist

Use this checklist when wiring the frontend:

- Call the endpoint matching the selected analytics tab.
- Convert the month picker to `start_time` and `end_time` date-only values.
- Send repeated query params for arrays.
- Render status columns from `response.statuses`.
- Render the top row from `response.summary`.
- Render body rows from `response.rows`.
- Use `row.status_metrics[status.id].percent_of_group` for row status percentages.
- Use `summary.status_metrics[status.id].percent_of_total` for summary status percentages.
- Format numbers and percentages on the frontend.
- Keep `status.id` as the status metric key; do not key by status name.
- Handle empty states when `summary.leads.count = 0`.
- Preserve the Figma table labels for the three product surfaces.
