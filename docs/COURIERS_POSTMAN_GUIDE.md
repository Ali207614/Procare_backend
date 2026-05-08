# 🚚 Courier Management API Guide

This guide provides instructions for testing the Courier Management endpoints in Postman. These endpoints are primarily used to list and filter couriers associated with specific branches.

---

## 🛠 Prerequisites

1. **Base URL**: `{{base_url}}` (e.g., `http://localhost:3000`)
2. **Admin Authentication**: Most endpoints require a `Bearer` token from an Admin login.
3. **Admin Setup**: You must have an Admin account and a role named `Courier` in the database.

---

## 🔑 Environment Variables

Add these to your Postman environment:

| Variable | Description | Example Value |
| :--- | :--- | :--- |
| `base_url` | API Base URL | `http://localhost:3000` |
| `admin_token` | JWT Token from Admin Login | `eyJhbGciOiJIUzI1...` |
| `branch_id` | ID of the branch to filter by | `00000000-0000-0000-0000-000000000000` |

---

## 📂 Endpoints

### 1. Get List of Couriers
Fetch a paginated list of couriers assigned to a specific branch.

- **Method**: `GET`
- **URL**: `{{base_url}}/couriers`
- **Headers**:
  - `Authorization`: `Bearer {{admin_token}}`
- **Query Parameters**:
  - `branch_id` (Required): The UUID of the branch.
  - `search` (Optional): Filter by courier name, phone number, or passport.
  - `limit` (Optional): Number of records to return (Default: 20).
  - `offset` (Optional): Number of records to skip (Default: 0).

#### 📝 Description:
This endpoint retrieves all admins who have the role `Courier` and are assigned to the specified `branch_id`. It also includes details about their assigned branches and current open repair orders (pickups and deliveries).

#### 📥 Example Request:
`GET {{base_url}}/couriers?branch_id=00000000-0000-0000-0000-000000000000&search=Akmal`

#### 📤 Sample Response:
```json
{
  "rows": [
    {
      "id": "a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6",
      "first_name": "Akmal",
      "last_name": "Karimov",
      "phone_number": "+998901234567",
      "status": "Open",
      "is_active": true,
      "created_at": "2024-01-01T12:00:00.000Z",
      "branches": [
        {
          "id": "00000000-0000-0000-0000-000000000000",
          "name_uz": "Texnik filial",
          "name_ru": "Технический филиал",
          "name_en": "Technical Branch"
        }
      ],
      "repair_orders": [
        {
          "repair_order_id": "r1o2-s3t4-u5v6",
          "type": "pickup",
          "status_name_uz": "Yangi",
          "status_name_ru": "Новый",
          "status_name_en": "New"
        }
      ]
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

---

## 🧪 Testing Tips

### 📝 Database Setup for Testing
Since couriers are admins with a specific role, ensure your database has:
1. A role with the exact name `Courier`.
2. An admin assigned to that role in `admin_roles`.
3. That same admin assigned to a branch in `admin_branches`.

### 🔍 Search Functionality
The `search` parameter performs a case-insensitive partial match on:
- `first_name`
- `last_name`
- `phone_number`

### 🔄 Pagination
The response includes a `total` field, which is useful for building pagination logic in front-end applications.

---

## ⚠️ Common Errors

| Status Code | Description | Fix |
| :--- | :--- | :--- |
| `401 Unauthorized` | Missing or invalid `admin_token`. | Login as an admin and update the `admin_token`. |
| `400 Bad Request` | Missing `branch_id` or invalid UUID format. | Ensure `branch_id` is a valid UUID in the query string. |
| `404 Not Found` | The specified `branch_id` does not exist. | Verify the `branch_id` exists in the `branches` table. |
