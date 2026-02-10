# Phone OS Types API - Postman Testing Guide

This guide provides instructions for testing the **Phone OS Types** API endpoints. This module manages the operating systems used by mobile devices (e.g., iOS, Android).

## 🔐 Prerequisites & Authentication

- **Base URL**: `{{base_url}}` (e.g., `http://localhost:3000`)
- **Headers**: All requests require an `Authorization` header with a Bearer token from an Admin account.
  - `Authorization: Bearer {{admin_token}}`
- **Required Permissions**:
  - `phone.os.create`
  - `phone.os.view`
  - `phone.os.update`
  - `phone.os.delete`

## 🌍 Environment Variables

Add these to your Postman environment:
| Variable | Description | Example |
| :--- | :--- | :--- |
| `base_url` | API Base URL | `http://localhost:3000` |
| `admin_token` | Admin JWT Token | `eyJhbG...` |
| `phone_os_type_id` | UUID of a specific OS type | `550e8400-e29b-41d4-a716-446655440000` |

---

## 🚀 API Endpoints

### 1. Create Phone OS Type
Creates a new phone operating system type.

- **Method**: `POST`
- **URL**: `{{base_url}}/phone-os-types`
- **Body** (Raw JSON):
```json
{
  "name_uz": "Harmony OS",
  "name_ru": "Harmony OS",
  "name_en": "Harmony OS"
}
```
- **Validation**:
  - `name_uz`, `name_ru`, `name_en` are required (1-50 characters).
  - Unique constraint on `name_uz`.
  - Service checks for conflicts across all name fields.

### 2. Get All Phone OS Types
Retrieves a paginated list of all active phone OS types.

- **Method**: `GET`
- **URL**: `{{base_url}}/phone-os-types`
- **Query Params** (Optional):
  - `limit`: Number of records (default 20)
  - `offset`: Starting index (default 0)
- **Response Shape**:
```json
{
  "rows": [
    {
      "id": "...",
      "name_uz": "iOS",
      "name_ru": "iOS",
      "name_en": "iOS",
      "sort": 1,
      "is_active": true,
      "status": "Open",
      "created_by": "...",
      "created_at": "...",
      "updated_at": "..."
    }
  ],
  "total": 2,
  "limit": 20,
  "offset": 0
}
```
- **Note**: This endpoint uses Redis caching. Cache keys: `phone_os_types:all:offset:limit`.

### 3. Update Phone OS Type
Updates the localized names of an existing OS type.

- **Method**: `PATCH`
- **URL**: `{{base_url}}/phone-os-types/{{phone_os_type_id}}`
- **Body** (Raw JSON):
```json
{
  "name_uz": "iOS Updated",
  "name_en": "iOS Updated"
}
```
- **Validation**:
  - All fields are optional but must follow character length rules if provided.
  - Conflict check: cannot update name to one that already exists for another OS.

### 4. Delete Phone OS Type (Soft Delete)
Soft deletes a phone OS type by setting its status to `Deleted`.

- **Method**: `DELETE`
- **URL**: `{{base_url}}/phone-os-types/{{phone_os_type_id}}`
- **Behavior**:
  - Checks if the OS type is associated with active `phone_categories`. If so, deletion is blocked.
  - Updates `status` to `Deleted`.
  - Clears Redis cache `phone_os_types:all`.

---

## 💡 Testing Tips

### Automated ID Capture
Add this to the **Tests** tab of the **Create** or **Get All** requests to automatically save the first OS type's ID:

```javascript
const response = pm.response.json();
if (response.id) {
    pm.environment.set("phone_os_type_id", response.id);
} else if (response.rows && response.rows.length > 0) {
    pm.environment.set("phone_os_type_id", response.rows[0].id);
}
```

### Dependency Order
1.  **Create** a new OS type.
2.  **Get All** to verify it exists and capture the ID.
3.  **Update** the OS type using the captured ID.
4.  **Delete** the OS type (ensure no `phone_categories` are linked to it first).
