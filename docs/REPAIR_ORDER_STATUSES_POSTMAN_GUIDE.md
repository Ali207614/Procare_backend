# 🛠 Repair Order Statuses API Testing Guide

This guide provides comprehensive instructions for testing the **Repair Order Statuses** API endpoints using Postman.

## 📋 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Variables](#environment-variables)
3. [Authentication](#authentication)
4. [Endpoints](#endpoints)
    - [Get All Statuses (Admin)](#get-all-statuses-admin)
    - [Create New Status](#create-new-status)
    - [Get Viewable Statuses](#get-viewable-statuses)
    - [Update Status Details](#update-status-details)
    - [Update Status Sort Order](#update-status-sort-order)
    - [Delete Status](#delete-status)
5. [Common Validations](#common-validations)

---

## 1. Prerequisites
- Access to an Admin account with the following permissions:
    - `repair.order.status.view`
    - `repair.order.status.create`
    - `repair.order.status.update`
    - `repair.order.status.delete`
- A valid `branch_id` from an open branch.

---

## 2. Environment Variables
Ensure the following variables are set in your Postman Environment:

| Variable | Description | Example Value |
| :--- | :--- | :--- |
| `base_url` | Base URL of the API | `http://localhost:5001/api/v1` |
| `admin_token` | JWT Token received after admin login | `eyJhbGci...` |
| `branch_id` | UUID of the branch to manage statuses for | `d3e4b1cd-8f20-4b94-b05c-63156cbe02ec` |
| `status_id` | UUID of a specific repair order status | `50000000-0000-0000-0001-001000000000` |

---

## 3. Authentication
All endpoints require a Bearer Token in the `Authorization` header.
- **Header**: `Authorization`
- **Value**: `Bearer {{admin_token}}`

---

## 4. Endpoints

### Get All Statuses (Admin)
Retrieve a paginated list of all statuses for a specific branch.

- **Method**: `GET`
- **URL**: `{{base_url}}/repair-order-statuses`
- **Query Params**:
    - `branch_id`: `{{branch_id}}` (Required)
    - `offset`: `0` (Optional)
    - `limit`: `20` (Optional)
- **Permissions**: `repair.order.status.view`

---

### Create New Status
Create a custom repair order status for a specific branch.

- **Method**: `POST`
- **URL**: `{{base_url}}/repair-order-statuses`
- **Body** (JSON):
```json
{
  "name_uz": "Test Status UZ",
  "name_ru": "Тест Статус RU",
  "name_en": "Test Status EN",
  "bg_color": "#E3F2FD",
  "color": "#1976D2",
  "branch_id": "{{branch_id}}",
  "can_user_view": true,
  "is_active": true,
  "can_add_payment": false
}
```
- **Permissions**: `repair.order.status.create`
- **Note**: The `sort` value is automatically calculated as the next available value if not provided.

---

### Get Viewable Statuses
Get statuses that the current admin is allowed to see based on their role permissions and branch.

- **Method**: `GET`
- **URL**: `{{base_url}}/repair-order-statuses/viewable`
- **Query Params**:
    - `branch_id`: `{{branch_id}}` (Required)
- **Permissions**: None (Uses internal logic to filter by admin role)
- **Response**: Includes `permissions` (view/edit/delete) and `transitions` (allowed next statuses) for each status.

---

### Update Status Details
Modify the properties of an existing status.

- **Method**: `PATCH`
- **URL**: `{{base_url}}/repair-order-statuses/{{status_id}}`
- **Body** (JSON):
```json
{
  "name_uz": "Updated Status Name",
  "bg_color": "#FFFFFF",
  "is_active": true
}
```
- **Permissions**: `repair.order.status.update`
- **Constraints**: 
    - Cannot deactivate (`is_active: false`) a **protected** status.
    - Status names must remain unique within the branch.

---

### Update Status Sort Order
Change the display order of a status. This endpoint handles re-ordering other statuses automatically.

- **Method**: `PATCH`
- **URL**: `{{base_url}}/repair-order-statuses/{{status_id}}/sort`
- **Body** (JSON):
```json
{
  "sort": 1
}
```
- **Permissions**: `repair.order.status.update`

---

### Delete Status
Soft delete a status (sets status to `Deleted`).

- **Method**: `DELETE`
- **URL**: `{{base_url}}/repair-order-statuses/{{status_id}}`
- **Permissions**: `repair.order.status.delete`
- **Constraints**: 
    - **Protected** statuses (e.g., 'New Order', 'Completed') cannot be deleted.

---

## 5. Common Validations

| Case | Expected Error | Reason |
| :--- | :--- | :--- |
| Missing `branch_id` | `400 Bad Request` | Required query parameter/body field. |
| Duplicate Name | `400 Bad Request` | Status name (UZ/RU/EN) must be unique in the branch. |
| Invalid Hex Color | `400 Bad Request` | `bg_color` and `color` must match `/^#[0-9A-Fa-f]{6}$/`. |
| Delete Protected | `403 Forbidden` | System statuses marked `is_protected: true` cannot be deleted. |
| Deactivate Protected | `403 Forbidden` | Cannot set `is_active: false` on protected statuses. |

---

## 💡 Postman Tips

### Setting Status ID Automatically
In the **Tests** tab of your "Create New Status" or "Get All Statuses" request, use this script:

```javascript
const response = pm.response.json();
if (response.id) {
    pm.environment.set("status_id", response.id);
} else if (response.rows && response.rows.length > 0) {
    pm.environment.set("status_id", response.rows[0].id);
}
```

### Seed Data Reference
Standard IDs for Branch 1 (from seeds):
- **New Order**: `50000000-0000-0000-0001-001000000000`
- **Diagnosis**: `50000000-0000-0000-0001-002000000000`
- **Ready**: `50000000-0000-0000-0001-007000000000`
- **Completed**: `50000000-0000-0000-0001-009000000000`
