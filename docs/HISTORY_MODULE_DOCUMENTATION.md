# History API Module Documentation

## 1. Executive Summary

The **History API Module** is a sophisticated auditing and data lineage tracking system designed to provide a high-integrity, immutable-style record of all significant state changes within the application.

### Purpose
Unlike traditional simple audit logs that only store "who changed what," this module builds a **Knowledge Graph** of application events. It records the relationship between actors (admins/users), the entities they manipulate (repair orders, branches, etc.), the specific fields modified, and the source of the data (API requests, system jobs, etc.).

### Business Problem Solved
- **Data Provenance:** Tracking the exact origin and evolution of critical data (e.g., how a repair order's status changed over time).
- **Compliance & Security:** Providing a cryptographically chained audit trail (`event_hash` linked to `previous_event_hash`) that makes unauthorized history tampering detectable.
- **Root Cause Analysis:** Allowing developers and support staff to visualize the "lineage" of a value to see which inputs or actions led to its current state.
- **Sensitive Data Handling:** Automatically masking or hashing sensitive information (phone numbers, passports) while still allowing for search and verification.

### Target Users
- **System Administrators:** For monitoring user activity and system integrity.
- **Support Staff:** For debugging data-related issues.
- **Auditors:** For verifying historical compliance.

---

## 2. Module Scope

The module handles the capture, storage, and retrieval of historical events and current value states.

### Included Features
- **Event Recording:** Generic engine for recording creation, updates, deletions, and relation changes.
- **Lineage Tracking:** Graph-based representation of data flow (Nodes & Edges).
- **Current Value Indexing:** Fast lookup of the most recent tracked value for any entity field.
- **Search:** Exact and normalized search across historical values.
- **Event Chaining:** Cryptographic hashing of events to ensure sequence integrity.
- **Redaction:** Automatic masking, hashing, or omission of sensitive fields based on configuration.

### Related Modules
- **PermissionsModule:** Used for authorization checks (`history.view`).
- **Knex/Database:** Primary storage engine (Postgres).

### Main Files involved

| File | Purpose |
|---|---|
| `history.controller.ts` | Exposes REST endpoints for search, timeline, and lineage visualization. |
| `history.service.ts` | Core business logic for recording events, managing the graph, and traversing lineage. |
| `history.types.ts` | Comprehensive type definitions for the graph (Nodes, Edges) and event structures. |
| `history.module.ts` | NestJS module definition, exporting the service for use in other modules. |
| `dto/history-query.dto.ts` | DTOs for pagination and lineage depth parameters. |
| `dto/search-history-values.dto.ts` | DTO for the specialized history value search engine. |

---

## 3. Architecture Overview

The module follows a graph-based architectural pattern for history tracking.

### Request Flow
1. **Client** → `HistoryController`
2. **Controller** (Guards/Permissions) → `HistoryService`
3. **Service** (Knex Query / Recursive CTE) → **Postgres Database**
4. **Database** → **History Tables** (`history_events`, `history_nodes`, `history_edges`)
5. **Response DTO** → **Client**

### Architecture Diagram
```text
Client (Web/Mobile)
       │
       ▼
[ HistoryController ] (Auth/Permission: history.view)
       │
       ▼
[ HistoryService ] ───▶ [ Graph Walker (Recursive CTE) ]
       │                         │
       ▼                         ▼
[ Knex / Postgres ] ◀─── [ History Schema (Nodes/Edges/Events) ]
```

### Core Concepts
- **Events:** The root of an action (e.g., "Repair Order Updated").
- **Nodes:** Abstract representations of actors, entities, field changes, and values.
- **Edges:** Semantic links between nodes (e.g., "Admin X *initiated* Event Y", "Event Y *changed* Field Z").
- **Current Values:** A snapshot table for the latest state of tracked fields to allow fast searching.

---

## 4. Endpoint Summary Table

| # | Method | Path | Purpose | Auth Required | Permission | Main Response |
|---|---|---|---|---|---|---|
| 1 | `GET` | `/history/values/search` | Search current tracked values (normalized) | Yes | `history.view` | `Paginated<HistoryCurrentValueRow>` |
| 2 | `GET` | `/history/values/:id/lineage` | Get lineage graph for a specific value | Yes | `history.view` | `HistoryLineageResponse` |
| 3 | `GET` | `/history/entities/:table/:id/timeline` | Get flat timeline of events for an entity | Yes | `history.view` | `Paginated<TimelineRow>` |
| 4 | `GET` | `/history/events/:event_id` | Get detailed event data and local graph | Yes | `history.view` | `HistoryEventDetail` |

---

## 5. Endpoint-by-Endpoint Documentation

### 5.1 Search Current Values

#### Method and Path
```http
GET /api/history/values/search
```

#### Purpose
Searches the `history_current_values` table. This allows finding entities by their current tracked fields (e.g., "Find all entities where the phone number is '+99890...'").

#### Authentication/Authorization
- **Auth:** JWT Admin required.
- **Permission:** `history.view`.

#### Path Parameters
*None.*

#### Query Parameters
| Parameter | Type | Required | Default | Description |
| --------- | ---- | -------- | ------- | ----------- |
| `value` | `string` | Yes | - | The value to search for (raw text). |
| `value_type` | `Enum` | No | - | Type of value (phone, email, uuid, etc.) for better normalization. |
| `entity_table` | `string` | No | - | Filter by specific table (e.g., `repair_orders`). |
| `field_path` | `string` | No | - | Filter by specific field (e.g., `phone_number`). |
| `limit` | `number` | No | 20 | Pagination limit (max 100). |
| `offset` | `number` | No | 0 | Pagination offset. |

#### Request Body
This endpoint does not require a request body.

#### Example Request
```http
GET /api/history/values/search?value=+998901234567&value_type=phone
```

#### Example Response
```json
{
  "rows": [
    {
      "id": "c8e76a14-...",
      "entity_table": "repair_orders",
      "entity_pk": "1001",
      "field_path": "phone_number",
      "value_type": "phone",
      "value_text": "+998 90 *** ** 67",
      "value_normalized": "+998901234567",
      "value_hash": "e3b0c442...",
      "ref_table": null,
      "ref_pk": null,
      "ref_label": null,
      "last_change_id": "b1a2c3d4-...",
      "current_since": "2026-05-08T09:00:00Z",
      "updated_at": "2026-05-08T10:00:00Z"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

#### UI Usage
Used in Global Search or Advanced Filtering to locate entities based on historical or current identifiers (IMEI, Phone, Customer Code).

#### QA/Test Notes
- Verify that searching for a masked value (e.g., searching for the full phone number) works even if the stored `value_text` is masked.
- Test searching with different `value_type` to ensure normalization (e.g., spaces in phone numbers).

---

### 5.2 Get Value Lineage

#### Method and Path
```http
GET /api/history/values/:current_value_id/lineage
```

#### Purpose
Explains the "why" behind a current value by returning a graph of preceding events, actors, and field changes.

#### Authentication/Authorization
- **Auth:** JWT Admin required.
- **Permission:** `history.view`.

#### Path Parameters
| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `current_value_id` | `UUID` | Yes | ID from `history_current_values`. |

#### Query Parameters
| Parameter | Type | Required | Default | Description |
| --------- | ---- | -------- | ------- | ----------- |
| `depth` | `number` | No | 4 | Graph traversal depth (1 to 8). |

#### Example Response
```json
{
  "currentValue": { "id": "...", "value_text": "Completed" },
  "producingChange": { "id": "...", "field_path": "status_id" },
  "event": { "id": "...", "action_key": "repair_orders.update" },
  "actors": [...],
  "entities": [...],
  "inputs": [...],
  "changes": [...],
  "graph": {
    "nodes": [
      { "id": "n1", "node_type": "event", "label": "repair_orders.update" },
      { "id": "n2", "node_type": "actor", "label": "John Doe" }
    ],
    "edges": [
      { "from_node_id": "n2", "to_node_id": "n1", "edge_type": "initiated" }
    ]
  }
}
```

---

### 5.3 Get Entity Timeline

#### Method and Path
```http
GET /api/history/entities/:table/:id/timeline
```

#### Purpose
Returns a chronologically sorted list of every event that affected a specific entity.

#### Path Parameters
| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `table` | `string` | Yes | Entity table name (e.g., `repair_orders`). |
| `id` | `string` | Yes | Entity primary key as text. |

#### Example Response
```json
{
  "rows": [
    {
      "event": { "id": "...", "occurred_at": "...", "action_key": "repair_orders.update" },
      "entities": [...],
      "changes": [
        { "field_path": "status", "old_value_text": "Pending", "new_value_text": "InProgress" }
      ],
      "actors": [...]
    }
  ],
  "total": 5,
  "limit": 20,
  "offset": 0
}
```

---

## 6. DTO Documentation

### SearchHistoryValuesDto
Purpose: Parameters for searching current value snapshot.
- `value`: `string` (Required) - Exact or partial text.
- `value_type`: `HistoryValueType` (Optional) - Hint for normalization.
- `entity_table`: `string` (Optional) - Scope search to a table.
- `field_path`: `string` (Optional) - Scope search to a field.

### HistoryPaginationDto
Purpose: Standard pagination.
- `limit`: `number` (Default: 20, Max: 100).
- `offset`: `number` (Default: 0).

---

## 7. Entity / Database Model Documentation

### Table: `history_events`
The audit root for every action.
| Field | Database Type | Description |
| ----- | ------------- | ----------- |
| `id` | `uuid` | Primary Key. |
| `occurred_at` | `timestamptz` | When the event happened. |
| `action_key` | `varchar` | Semantic key (e.g., `repair_orders.create`). |
| `action_kind` | `varchar` | create, update, delete, etc. |
| `source_type` | `varchar` | admin_api, system_job, etc. |
| `event_hash` | `char(64)` | Cryptographic integrity hash. |
| `previous_event_hash`| `char(64)` | Link to previous event hash. |

### Table: `history_field_changes`
Detailed diff for each field.
| Field | Database Type | Description |
| ----- | ------------- | ----------- |
| `old_value_text` | `text` | Human readable old value. |
| `new_value_text` | `text` | Human readable new value. |
| `old_value_hash` | `char(64)` | SHA256 of normalized old value. |
| `new_value_hash` | `char(64)` | SHA256 of normalized new value. |

---

## 8. Business Logic Documentation

### Event Recording Process
When `recordEntityUpdated` is called:
1. **Flattening:** The "before" and "after" objects are flattened (nested JSON becomes `parent.child`).
2. **Diffing:** Only changed fields are extracted.
3. **Normalization:** Values are passed through `normalizeValue` (e.g., phone numbers are cleaned).
4. **Hashing:** Normalized values are hashed for indexing.
5. **Redaction:** Sensitive fields are masked or omitted based on `history_tracked_fields` config.
6. **Graph Creation:** Nodes and Edges are created for the event, actor, and entity.
7. **Snapshot Update:** The `history_current_values` table is updated with the latest state.

### Graph Traversal
The `getValueLineage` endpoint uses a **Postgres Recursive CTE** (Common Table Expression) to walk the `history_edges` table up to a depth of 8 levels, reconstruct the history of a specific value.

---

## 9. Permissions and Security

| Role/Permission | Can Access | Limitations |
| --------------- | ---------- | ----------- |
| `history.view` | All endpoints | Read-only. |

### Redaction Strategies
- **`none`**: Full value stored.
- **`mask`**: Stored as `+998 90 *** ** 67`.
- **`hash_only`**: `value_text` is null, only `value_hash` is stored.
- **`omit`**: Nothing is stored (used for passwords).

---

## 10. Filtering, Searching, and Pagination

- **Exact Search:** Uses `value_hash` for O(1) lookups on normalized values.
- **Partial Search:** Only available for `string` and `text` types using `LIKE`.
- **Sorting:** Timelines are strictly sorted by `occurred_at DESC`.

---

## 11. Error Handling

| Error | Cause | HTTP Status | Notes |
| ----- | ----- | ----------- | ----- |
| `NotFoundException` | ID does not exist in history tables. | 404 | Common for `event_id` or `current_value_id`. |
| `BadRequestException`| Invalid UUID or missing query params. | 400 | Validation pipe error. |

---

## 12. Frontend Integration Guide

### Recommended API Client (TypeScript)
```typescript
interface HistoryTimelineItem {
  event: HistoryEvent;
  changes: HistoryChange[];
  actors: HistoryActor[];
}

const getHistoryTimeline = (table: string, id: string) => 
  axios.get(`/history/entities/${table}/${id}/timeline`);
```

---

## 13. Dedicated UI/UX Documentation

### Recommended UI Components
1. **Lineage Graph:** Use a graph library (e.g., React Flow) to visualize the output of the `/lineage` endpoint.
2. **Timeline View:** A standard vertical list showing "Who did what and when".
3. **Audit Drawer:** A side drawer that opens when clicking a timeline item, showing the raw event metadata and GeoIP info (if available).

### Details Drawer Content
- **Actor:** Name and IP Address.
- **Request:** HTTP Path and User Agent.
- **Changes:** Table showing Field, Old Value, and New Value.
- **Integrity:** Show "Verified" if `event_hash` matches current record state.

---

## 14. Backend Improvement Recommendations

### Recommendation: GeoIP Resolution Logic
**Problem:** The schema has `ip_country_code`, `ip_city`, etc., but the `HistoryService` currently does not populate them.
**Priority:** Medium.
**Action:** Integrate a GeoIP provider (e.g., MaxMind) in `createEvent`.

### Recommendation: Export Endpoint
**Problem:** Large audit trails are hard to review in a UI.
**Priority:** Low.
**Action:** Add a `GET /history/entities/:table/:id/export` endpoint for CSV.

---

## 15. QA Documentation

### Functional Test Cases
- [ ] Create a record with a phone number. Search for that phone number in `history/values/search`.
- [ ] Update a record. Verify the timeline shows the `old_value` and `new_value` correctly.
- [ ] Verify that a `Super Admin` can see the history, but a `Manager` without `history.view` receives a 403.

---

## 16. Developer Notes

- **Circular Edges:** The graph walker (`walkGraph`) includes loop detection to prevent infinite recursion.
- **System Fields:** `created_at` and `updated_at` are automatically filtered out from tracked changes in `buildEntityChanges`.
- **References:** The `referenceTableForField` helper maps field names (like `user_id`) to their respective tables (like `users`) to facilitate label resolution in the UI.

---

## 17. Final Implementation-Ready Summary

The History Module is a robust, production-ready system. 
- **Current State:** Backend is fully implemented with high-integrity graph tracking and search.
- **Frontend Priority:** Implement the Timeline view first, followed by Search.
- **Complexity:** High. Developers should use the provided DTOs and avoid manual queries to history tables.

---
*Generated: 2026-05-08*
*Target: docs/HISTORY_MODULE_DOCUMENTATION.md*
