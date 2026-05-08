# 🧱 Roles Module Postman Testing Guide

This guide provides comprehensive instructions for testing the Roles API endpoints.

## 📋 Prerequisites

- **Authentication**: All endpoints require a valid JWT Admin token.
- **Permissions**: The testing admin must have the following permissions:
    - `role.create`
    - `role.view`
    - `role.update`
    - `role.delete`
- **Base URL**: `{{base_url}}` (e.g., `http://localhost:3000`)

---

## ⚙️ Environment Variables

To make testing easier, add these to your Postman environment:

| Variable | Description |
| :--- | :--- |
| `base_url` | API Base URL |
| `admin_token` | JWT Token for Admin |
| `role_id` | UUID of the created role (set automatically by tests) |
| `perm_id_1` | `00000000-0000-0000-0000-000000000021` (role.view) |
| `perm_id_2` | `00000000-0000-0000-0000-000000000022` (role.create) |

---

## 🚀 Endpoints

### 1. Create New Role
**POST** `{{base_url}}/roles`

- **Headers**:
    - `Authorization: Bearer {{admin_token}}`
- **Body** (JSON):
```json
{
    "name": "Test Manager",
    "permission_ids": [
        "{{perm_id_1}}",
        "{{perm_id_2}}"
    ],
    "is_active": true
}
```
- **Postman Test Script**:
```javascript
const response = pm.response.json();
if (pm.response.code === 201) {
    pm.environment.set("role_id", response.id);
}
```

### 2. Get All Roles (List)
**GET** `{{base_url}}/roles`

- **Headers**:
    - `Authorization: Bearer {{admin_token}}`
- **Query Params**:
    - `search`: (Optional) Filter by role name
    - `is_active`: `true` | `false`
    - `is_protected`: `true` | `false`
    - `limit`: `20`
    - `offset`: `0`
- **Description**: Returns a paginated list of roles with creator details.

### 3. Get Role by ID
**GET** `{{base_url}}/roles/{{role_id}}`

- **Headers**:
    - `Authorization: Bearer {{admin_token}}`
- **Description**: Retrieves full details of a specific role, including its permissions.

### 4. Update Role by ID
**PATCH** `{{base_url}}/roles/{{role_id}}`

- **Headers**:
    - `Authorization: Bearer {{admin_token}}`
- **Body** (JSON):
```json
{
    "name": "Updated Test Manager",
    "permission_ids": [
        "{{perm_id_1}}"
    ],
    "is_active": true
}
```
- **Note**: If the role is `is_protected: true`, you cannot deactivate it or change its permissions (only name can be changed).

### 5. Delete Role by ID (Soft Delete)
**DELETE** `{{base_url}}/roles/{{role_id}}`

- **Headers**:
    - `Authorization: Bearer {{admin_token}}`
- **Description**: Sets role status to `Deleted` and `is_active` to `false`.
- **Constraint**: Cannot delete protected roles (e.g., `Super Admin`).

---

## 💡 Pro-Tips for Testing

### Handling Protected Roles
The system has some roles that are "protected" (e.g., Super Admin with ID `00000000-0000-0000-0000-000000000000`).
- If you try to **DELETE** or **DEACTIVATE** these roles, the API will return a `403 Forbidden` error. This is expected behavior.

### Permission Validation
When creating or updating a role, ensure the `permission_ids` provided actually exist and are `is_active: true`. Otherwise, the API will return a `400 Bad Request`.

### Redis Cache
When you update a role's permissions, the system automatically clears the permission cache for all admins who have that role. This ensures that permission changes take effect immediately for logged-in admins.
