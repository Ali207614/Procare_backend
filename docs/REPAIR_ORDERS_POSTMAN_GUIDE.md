# Repair Orders API Postman Guidance

This guide provides instructions for testing the **Repair Orders** module. This module is complex and includes handling attachments, comments, delivery/pickup, and rental phones.

## 📋 Prerequisites

- **Admin Authentication**: All endpoints require a `JwtAdminAuthGuard`. You must include a Bearer token.
- **Base URL**: `{{base_url}}` (e.g., `http://localhost:3000`)
- **Headers**:
  - `Authorization: Bearer {{admin_token}}`
  - `Content-Type: application/json`

---

## 🛠 Environment Variables

Recommended Postman environment variables:
- `base_url`: `http://localhost:3000`
- `admin_token`: Your JWT token
- `branch_id`: `00000000-0000-0000-0000-000000000000` (Technical Branch)
- `status_id`: `50000000-0000-0000-0001-001000000000` (New Order Status)
- `user_id`: Choose a valid user ID from `users` table
- `phone_category_id`: Choose a valid phone category ID
- `repair_order_id`: (Set after creation)

---

## 🚀 Core Endpoints

### 1. Create Repair Order
- **Method**: `POST`
- **URL**: `{{base_url}}/repair-orders`
- **Body**:
```json
{
  "user_id": "{{user_id}}",
  "phone_category_id": "{{phone_category_id}}",
  "status_id": "{{status_id}}",
  "priority": "Medium",
  "admin_ids": ["00000000-0000-0000-0000-000000000000"],
  "initial_problems": [
    {
      "problem_category_id": "d3e4b1cd-8f20-4b94-b05c-63156cbe02ec",
      "price": 100000,
      "estimated_minutes": 60,
      "parts": [
        {
          "id": "7b2e2f60-5f0c-4c44-b2bb-6d7d0eeb7c6c",
          "part_price": 12000,
          "quantity": 1
        }
      ]
    }
  ],
  "comments": [
    {
      "text": "Device has water damage"
    }
  ],
  "pickup": {
    "lat": 41.2995,
    "long": 69.2401,
    "description": "Main office"
  },
  "rental_phone": {
    "rental_phone_id": "d3e4b1cd-8f20-4b94-b05c-63156cbe02ec",
    "is_free": true,
    "notes": "Temporary replacement"
  }
}
```

### 2. Get All Repair Orders (by Branch)
- **Method**: `GET`
- **URL**: `{{base_url}}/repair-orders?branch_id={{branch_id}}&limit=20&offset=0`
- **Query Params**:
  - `branch_id`: (Required) UUID
  - `sort_by`: `sort`, `priority`, `created_at`, `updated_at`
  - `sort_order`: `asc`, `desc`
  - `customer_name`: Search string
  - `phone_number`: Search string
  - `order_number`: Search string

### 3. Get Repair Order Details
- **Method**: `GET`
- **URL**: `{{base_url}}/repair-orders/{{repair_order_id}}`

### 4. Update Repair Order (General)
- **Method**: `PATCH`
- **URL**: `{{base_url}}/repair-orders/{{repair_order_id}}`
- **Body**:
```json
{
  "priority": "High",
  "status_id": "{{new_status_id}}"
}
```

### 5. Move Repair Order (Status Change)
- **Method**: `PATCH`
- **URL**: `{{base_url}}/repair-orders/{{repair_order_id}}/move`
- **Body**:
```json
{
  "status_id": "{{target_status_id}}"
}
```

### 6. Update Client Information
- **Method**: `PATCH`
- **URL**: `{{base_url}}/repair-orders/{{repair_order_id}}/client`
- **Body**:
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+998901234567",
  "email": "john.doe@example.com"
}
```

---

## 📎 Attachments & Comments

### Create Comment
- **Method**: `POST`
- **URL**: `{{base_url}}/repair-orders/{{repair_order_id}}/comments`
- **Body**:
```json
{
  "text": "Technician started working on the logic board"
}
```

### Upload Attachment
- **Method**: `POST`
- **URL**: `{{base_url}}/repair-orders/{{repair_order_id}}/attachments`
- **Body**: `form-data`
  - `file`: (Select file)
  - `description`: "Internal photo of the damage"

---

## 👥 Admin Assignment

### Assign Admins
- **Method**: `POST`
- **URL**: `{{base_url}}/repair-orders/{{repair_order_id}}/assign-admins`
- **Body**:
```json
{
  "admin_ids": ["admin-uuid-1", "admin-uuid-2"]
}
```

### Remove Admin
- **Method**: `DELETE`
- **URL**: `{{base_url}}/repair-orders/{{repair_order_id}}/assign-admins/{{admin_id}}`

---

## 🚚 Delivery & Pickup

### Create Pickup
- **Method**: `POST`
- **URL**: `{{base_url}}/repair-orders/{{repair_order_id}}/pickup`
- **Body**:
```json
{
  "lat": 41.3111,
  "long": 69.2797,
  "description": "Gate 2, Office building"
}
```

---

## 📱 Rental Phone

### Assign Rental Phone
- **Method**: `POST`
- **URL**: `{{base_url}}/repair-orders/{{repair_order_id}}/rental-phone`
- **Body**:
```json
{
  "rental_phone_id": "7079c5f3-6f1c-41d8-8823-c3226f7df0a9",
  "is_free": false,
  "price": 50000,
  "currency": "UZS"
}
```

---

## 💡 Postman Tips

### Automatically Set `repair_order_id`
In the **Tests** tab of your "Create Repair Order" request:
```javascript
const response = pm.response.json();
if (response.id) {
    pm.environment.set("repair_order_id", response.id);
    console.log("Setting repair_order_id to: " + response.id);
}
```

### Testing Flows
1. **Creation Flow**: Create User -> Create Phone Category -> Create Repair Order.
2. **Workflow Flow**: Move status from `New` -> `Diagnosis` -> `Ready`.
3. **Completion Flow**: Add Final Problems -> Move to `Completed`.

