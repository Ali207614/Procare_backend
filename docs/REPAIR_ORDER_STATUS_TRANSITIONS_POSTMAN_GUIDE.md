# Repair Order Status Transitions API Testing Guide

This guide provides instructions for testing the **Repair Order Status Transitions** module. This module defines the valid paths a Repair Order can take between different statuses (e.g., from "Pending" to "In Progress").

## 📋 Prerequisites

### 1. Authentication
All endpoints require a valid Admin JWT token.
- **Header**: `Authorization: Bearer {{admin_token}}`

### 2. Permissions
To update transitions, the admin must have the `repair.status.transition` permission.

### 3. Environment Variables
Ensure the following variables are set in your Postman environment:
- `base_url`: The API base URL (e.g., `http://localhost:3000`)
- `admin_token`: The JWT token obtained after admin login.
- `from_status_id`: A UUID of an existing repair order status (e.g., from `repair-order-statuses` list).
- `to_status_id_1`, `to_status_id_2`: UUIDs of statuses you want to allow transitions to.

---

## 🚀 Endpoints

### 1. List All Transitions
Retrieves a list of all defined status transitions across all branches.

- **Method**: `GET`
- **URL**: `{{base_url}}/repair-order-status-transitions`
- **Description**: Returns an array of transition objects showing `from_status_id` and `to_status_id`.

---

### 2. Upsert Transitions
Updates the allowed "next" statuses for a specific "from" status. This is a destructive update: it deletes all existing transitions for the `from_status_id` and replaces them with the ones provided in the body.

- **Method**: `POST`
- **URL**: `{{base_url}}/repair-order-status-transitions/:status_id`
- **Path Variable**: 
    - `status_id`: The UUID of the source status (e.g., `{{from_status_id}}`).
- **Body** (JSON):
```json
{
  "to_status_ids": [
    "{{to_status_id_1}}",
    "{{to_status_id_2}}"
  ]
}
```
- **Validation Rules**:
    - `to_status_ids` must be an array of unique UUIDs.
    - All `to_status_ids` must belong to the same branch as the `from_status_id`.
- **Side Effects**:
    - Updates Redis cache for fast lookup during order status updates.
    - Flushes status viewable cache for the affected branch.

---

## 🧪 Testing Workflow Example

1. **Login as Admin**: Get the `admin_token`.
2. **Find Statuses**: Call `GET {{base_url}}/repair-order-statuses` to find two statuses in the same branch.
   - Example Branch: `Branch A`
   - From Status: "Diagnosis" (ID: `aaa-bbb-ccc`)
   - To Status: "Repairing" (ID: `ddd-eee-fff`)
3. **Set Transition**:
   - `POST {{base_url}}/repair-order-status-transitions/aaa-bbb-ccc`
   - Body: `{"to_status_ids": ["ddd-eee-fff"]}`
4. **Verify**:
   - Call `GET {{base_url}}/repair-order-status-transitions` and check if the transition `aaa-bbb-ccc` -> `ddd-eee-fff` exists.

## 💡 Postman Tips

### Automatically Set `status_id` from List
In the `Tests` tab of the `List All Statuses` request, you can save the first status ID to a variable:

```javascript
const response = pm.response.json();
if (response && response.rows && response.rows.length > 0) {
    pm.environment.set("from_status_id", response.rows[0].id);
}
```

### Error Scenarios to Test
- **Unauthorized**: Call endpoints without `Authorization` header.
- **Cross-Branch Transition**: Attempt to add a `to_status_id` that belongs to a different branch than `from_status_id`. Expected: `400 Bad Request`.
- **Invalid UUID**: Send an invalid UUID format in the body or path.
- **Empty Transitions**: Pass an empty array `[]` to `to_status_ids` to remove all transitions for a status.
