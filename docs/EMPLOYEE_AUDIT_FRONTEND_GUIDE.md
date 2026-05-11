# API Collaboration Guide: Admin Management & Audit Timeline

This guide explains how to use the **Employees (Admins)** and **History (Audit)** endpoints together to implement an employee management dashboard with a full audit trail.

## 1. Overview
The Procare backend uses a specialized history module to track every change to administrative users. To provide a complete view of an employee's lifecycle, you should use two primary endpoints in collaboration:
- **`GET /admins`**: To list and search for administrators.
- **`GET /history/entities/admins/:id/timeline`**: To fetch the chronological history of changes for a specific administrator.

---

## 2. Listing and Finding Employees
**Endpoint**: `GET /admins`

Use this endpoint to populate your main employee list or search results.

### Request Query Parameters (`FindAllAdminsDto`)
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `search` | `string` | No | Search by name, phone, or passport. |
| `status` | `string[]` | No | `Open`, `Pending`, `Banned`. |
| `branch_ids` | `UUID[]` | No | Filter by assigned branches. |
| `role_ids` | `UUID[]` | No | Filter by assigned roles. |
| `limit` | `number` | No | Default: 20. |
| `offset` | `number` | No | For pagination. |

### Response Structure
The response is paginated. Each item in the `rows` array contains essential identification data (ID, Name, Phone) and relationship data (Branches, Roles).

---

## 3. Retrieving the Audit Timeline
**Endpoint**: `GET /history/entities/admins/:admin_id/timeline`

Once you have an administrator's `id` from the list above, you can fetch their activity history.

### Path Parameters
| Parameter | Type | Description |
| :--- | :--- | :--- |
| `admin_id` | `UUID` | The ID of the administrator (e.g., from the `/admins` list). |

### Query Parameters
| Parameter | Type | Description |
| :--- | :--- | :--- |
| `limit` | `number` | Max 100 per page. |
| `offset` | `number` | For pagination. |

### Interpreting the Timeline Response
The `rows` in this response represent **History Events**. Each event includes:
- **`event`**: Metadata like `occurred_at` (timestamp) and `action_key` (e.g., `admins.update`).
- **`actors`**: Who performed the action (usually another Admin).
- **`changes`**: A list of what actually changed.
  - `field_path`: The property name (e.g., `is_active`).
  - `old_value_text` / `new_value_text`: The "before" and "after" values.
  - `operation`: `insert`, `update`, `delete`, `link`, or `unlink`.

---

## 4. Frontend Implementation Workflow

### Step 1: Identification
The user searches for an employee in the UI. You call:
`GET /admins?search=Alex`

### Step 2: Selection
The user clicks on a row to see "Details" or "History". You extract the `id` (e.g., `550e8400...`).

### Step 3: Audit Display
You call the history endpoint to show an activity feed:
`GET /history/entities/admins/550e8400.../timeline`

### Example UI Mapping:
- **Action**: `admins.update` → **UI Text**: "Profile Updated"
- **Field**: `status` | `Open` → `Banned` → **UI Text**: "Status changed from Open to Banned"
- **Actor**: "Super Admin" → **UI Text**: "Changed by Super Admin"

---

## 5. Permissions
Ensure the logged-in user has the following permissions:
1. `admin.manage.view_all`: To see the list of admins.
2. `history.view`: To access the audit timeline.

Both endpoints require a valid Bearer Token in the `Authorization` header.
