# Frontend Guide: POST /repair-orders/open

This document covers only the public repair-order application endpoint:

```http
POST /api/v1/repair-orders/open
Content-Type: application/json
```

## Purpose

Use this endpoint from the public website/app form when a customer wants to submit a repair request without logging in as an admin.

This endpoint:

- does not require `Authorization`;
- creates or reuses a customer by phone number;
- creates a new repair order with `source: "Web"`;
- assigns the configured public branch automatically;
- assigns the default active `Open` repair-order status automatically;
- returns the created `repair_orders` row.

Do not use this endpoint for the authenticated admin repair-order create flow. Admin creation uses `POST /api/v1/repair-orders`.

## Request Body

All four fields must be present. Extra fields are rejected.

| Field            |   Type | Required |   Max | Notes                                                                                                                   |
| ---------------- | -----: | -------: | ----: | ----------------------------------------------------------------------------------------------------------------------- |
| `name`           | string |      yes |   200 | Customer full name. Trimmed and collapsed to single spaces. Must not be empty after trim.                               |
| `phone_number`   | string |      yes |    30 | Uzbekistan phone number. Backend stores it as E.164, for example `+998901234567`.                                       |
| `phone_category` | string |      yes |   200 | Either an existing leaf phone-category UUID or free text such as `iPhone 13 Pro`.                                       |
| `description`    | string |      yes | 10000 | Customer problem description. Empty string is accepted and stored as `null` unless a custom phone category is appended. |

### Recommended Payload

```json
{
  "name": "Asilbek Azimov",
  "phone_number": "+998901234567",
  "phone_category": "iPhone 13 Pro",
  "description": "Screen is broken and the battery drains quickly."
}
```

### Payload With Existing Phone Category UUID

```json
{
  "name": "Asilbek Azimov",
  "phone_number": "901234567",
  "phone_category": "550e8400-e29b-41d4-a716-446655440000",
  "description": "Display cracked after a drop."
}
```

## Field Behavior

### `name`

The backend trims leading/trailing spaces and replaces repeated whitespace with one space.

Example:

```text
"  Asilbek   Azimov  " -> "Asilbek Azimov"
```

For the linked customer record:

- first word becomes `first_name`;
- remaining words become `last_name`;
- if an existing customer is found by phone and has missing name fields, those missing fields may be filled.

### `phone_number`

The frontend should send `+998XXXXXXXXX` whenever possible.

Accepted examples:

```text
+998901234567 -> +998901234567
998901234567  -> +998901234567
901234567     -> +998901234567
0901234567    -> +998901234567
8901234567    -> +998901234567
```

Important:

- values starting with `+` must be Uzbekistan numbers beginning with `+998`;
- non-digit formatting characters are ignored, so `+998 (90) 123-45-67` is accepted;
- the response always returns the normalized value in `phone_number`.

### `phone_category`

This field has two modes.

If the value is a UUID:

- backend treats it as an existing `phone_categories.id`;
- the category must exist, be active, have `status: "Open"`, and must not have child categories;
- on success, `phone_category_id` is set to that UUID.

If the value is not a UUID:

- backend treats it as custom phone model text;
- `phone_category_id` is not set;
- the custom value is appended to the repair-order description as:

```text
Phone category: iPhone 13 Pro
```

If the value looks like a UUID but does not match an active leaf category, it fails with a `400`.

### `description`

The backend trims the description.

If `phone_category` is custom text, the final stored description becomes:

```text
<trimmed description>
Phone category: <custom phone category>
```

The final stored description must be at most 10000 characters, including the appended custom phone-category line.

## Success Response

Status code: `201 Created`

The response is the raw repair-order row, not the detailed admin repair-order response.

```json
{
  "id": "7c54c7bd-c01e-4e95-ae70-c88283f61f2b",
  "number_id": 1024,
  "user_id": "9583be3b-9e19-4b3d-a110-7ec44ce734f7",
  "branch_id": "00000000-0000-4000-8000-000000000000",
  "total": "0.00",
  "imei": null,
  "phone_category_id": null,
  "status_id": "2a56dc59-7966-47a5-960a-9b7d3c8f9d99",
  "delivery_method": "Self",
  "pickup_method": "Self",
  "sort": 1,
  "priority": "Medium",
  "priority_level": 2,
  "agreed_date": null,
  "reject_cause_id": null,
  "region_id": null,
  "created_by": null,
  "status": "Open",
  "phone_number": "+998901234567",
  "name": "Asilbek Azimov",
  "description": "Screen is broken and the battery drains quickly.\nPhone category: iPhone 13 Pro",
  "source": "Web",
  "call_count": 0,
  "missed_calls": 0,
  "customer_no_answer_count": 0,
  "last_customer_no_answer_at": null,
  "customer_no_answer_due_at": null,
  "created_at": "2026-04-28T10:30:00.000Z",
  "updated_at": "2026-04-28T10:30:00.000Z"
}
```

Frontend should usually show a success state using `number_id`, for example:

```text
Your request was received. Order number: #1024
```

## Error Response Shape

Most frontend-actionable failures return `400 Bad Request`.

```json
{
  "statusCode": 400,
  "message": "Phone number must be an Uzbekistan phone number",
  "error": "BadRequestException",
  "location": "phone_number",
  "timestamp": "2026-04-28T10:30:00.000Z",
  "path": "/api/v1/repair-orders/open"
}
```

Use `location` to map the error to a form field when possible.

## Common Validation Errors

| Location         | Message                                                     | When it happens                                                         |
| ---------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| `name`           | `Name must not be empty`                                    | Name is empty or only spaces.                                           |
| `name`           | `Name must not exceed 200 characters`                       | Name is longer than 200 chars.                                          |
| `phone_number`   | `Phone number must be a string`                             | Missing or non-string phone number.                                     |
| `phone_number`   | `Phone number must be an Uzbekistan phone number`           | Value starts with `+` but is not `+998...`.                             |
| `phone_number`   | `Phone number must match Uzbekistan phone number structure` | Backend cannot extract a valid 9-digit local number.                    |
| `phone_number`   | `Phone number must not exceed 30 characters`                | Raw phone input is longer than 30 chars.                                |
| `phone_category` | `Phone category must not be empty`                          | Category is empty or only spaces.                                       |
| `phone_category` | `Phone category not found or inactive`                      | UUID was sent but no active open category exists.                       |
| `phone_category` | `Phone category must not have children`                     | UUID points to a parent category instead of a selectable leaf category. |
| `description`    | `Description must not exceed 10000 characters`              | Final stored description is too long.                                   |
| `branch_id`      | `No active branch found for public applications`            | Backend has no active public/fallback branch.                           |
| `branch_id`      | `No active open repair order status found for this branch`  | Backend branch has no active `Open` repair-order status.                |

With unknown/extra fields, validation returns a `400` similar to:

```json
{
  "statusCode": 400,
  "message": "property email should not exist",
  "error": "ValidationError",
  "location": "email",
  "timestamp": "2026-04-28T10:30:00.000Z",
  "path": "/api/v1/repair-orders/open"
}
```

## Frontend Integration Notes

- Send only `name`, `phone_number`, `phone_category`, and `description`.
- Disable the submit button while the request is pending to avoid accidental duplicates.
- Prefer collecting the phone number with a `+998` mask, but still send the full string as typed.
- If using a category selector, send only leaf category UUIDs.
- If allowing free-text device models, send the typed model in `phone_category`.
- Show field-level errors using `location`; show a generic toast/banner when `location` is missing.
- Treat `201` as success. Do not require a follow-up fetch for confirmation unless the UI needs detailed admin-only data.
- The endpoint triggers internal admin notifications and webhook delivery asynchronously; the frontend does not need to wait for those side effects.

## Minimal Fetch Example

```ts
type OpenRepairOrderPayload = {
  name: string;
  phone_number: string;
  phone_category: string;
  description: string;
};

async function createOpenRepairOrder(
  baseUrl: string,
  payload: OpenRepairOrderPayload,
): Promise<{ id: string; number_id: number; phone_number: string }> {
  const response = await fetch(`${baseUrl}/api/v1/repair-orders/open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw data;
  }

  return data;
}
```
