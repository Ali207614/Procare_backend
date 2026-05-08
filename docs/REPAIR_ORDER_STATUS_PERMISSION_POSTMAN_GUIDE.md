# Repair Order Status Permissions API Guide

This guide provides instructions and examples for testing the **Repair Order Status Permissions** module using Postman. This module manages which roles have specific permissions (viewing, updating, deleting, payments, etc.) for repair orders in specific statuses within a branch.

## 🛠 Prerequisites

- **Base URL**: `{{base_url}}` (e.g., `http://localhost:3000`)
- **Admin Token**: `{{admin_token}}` (Obtained from Admin Login)
- **Permissions**: The admin must have the `repair.status.permission` permission to assign or update permissions.

### 📋 Environment Variables
Ensure the following variables are set in your Postman environment:
- `branch_id`: A valid UUID of an active branch.
- `role_id`: A valid UUID of an active role.
- `status_id`: A valid UUID of an active repair order status.

---

## 🚀 Endpoints

### 1. Bulk Assign or Update Permissions
Assigns permissions for a specific role across multiple status IDs in a branch. If permissions already exist for the given role and status, they will be replaced.

- **URL**: `{{base_url}}/repair-order-status-permissions/bulk-assign`
- **Method**: `PUT`
- **Headers**:
  - `Authorization`: `Bearer {{admin_token}}`
- **Body** (JSON):
```json
{
  "branch_id": "{{branch_id}}",
  "role_id": "{{role_id}}",
  "status_ids": ["{{status_id}}"],
  "can_add": true,
  "can_view": true,
  "can_update": true,
  "can_delete": false,
  "can_payment_add": true,
  "can_payment_cancel": false,
  "can_assign_admin": true,
  "can_notification": true,
  "can_notification_bot": false,
  "can_change_active": true,
  "can_change_status": true,
  "can_view_initial_problems": true,
  "can_change_initial_problems": true,
  "can_view_final_problems": true,
  "can_change_final_problems": true,
  "can_comment": true,
  "can_pickup_manage": true,
  "can_delivery_manage": true,
  "can_view_payments": true,
  "can_manage_rental_phone": true,
  "can_view_history": true,
  "can_user_manage": true
}
```

- **Note**: This endpoint flushes the Redis cache for the updated permissions.

---

### 2. Get Permissions by Status ID
Retrieves all permission records associated with a specific repair order status.

- **URL**: `{{base_url}}/repair-order-status-permissions/by-status/{{status_id}}`
- **Method**: `GET`
- **Headers**:
  - `Authorization`: `Bearer {{admin_token}}`

---

### 3. Get Permission by Role and Status
Retrieves the specific permission record for a single role and a single status. This endpoint uses Redis caching.

- **URL**: `{{base_url}}/repair-order-status-permissions/by-role/{{role_id}}/status/{{status_id}}`
- **Method**: `GET`
- **Headers**:
  - `Authorization`: `Bearer {{admin_token}}`

---

### 4. Get Permissions by Role and Branch
Retrieves all permission records for a specific role within a specific branch across all statuses.

- **URL**: `{{base_url}}/repair-order-status-permissions/by-role/{{role_id}}/branch/{{branch_id}}`
- **Method**: `GET`
- **Headers**:
  - `Authorization`: `Bearer {{admin_token}}`

---

## 💡 Postman Tips

### Automatically Set Environment Variables
You can use the **Tests** tab in Postman to automatically save IDs for later use.

**Example for fetching by status:**
```javascript
const response = pm.response.json();
if (response && response.length > 0) {
    pm.environment.set("permission_id", response[0].id);
}
```

### Validation Considerations
- **Status Open**: Both the Role and the Repair Order Status must have a status of `'Open'` in the database.
- **Branch Matching**: The Repair Order Statuses must belong to the specified `branch_id`.
