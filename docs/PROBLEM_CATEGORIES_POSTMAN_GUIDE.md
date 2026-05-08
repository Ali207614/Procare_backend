# Problem Categories API Testing Guide

This guide provides instructions for testing the Problem Categories API endpoints. This module manages repair problems (e.g., "Screen Issues", "Battery Drains Fast") and their hierarchy.

## 📌 Prerequisites

- **Base URL**: `{{base_url}}` (e.g., `http://localhost:3000`)
- **Headers**:
    - `Authorization`: `Bearer {{admin_token}}`
    - `Content-Type`: `application/json`
- **Permissions Required**:
    - `problem.category.create`
    - `problem.category.update`
    - `problem.category.delete`

---

## 🏗 Environment Variables

Ensure these are set in your Postman Environment:
- `base_url`: The root URL of the API.
- `admin_token`: A valid JWT token for an admin.
- `phone_category_id`: ID of a leaf phone category (e.g., `10000000-0000-0000-0000-000000000002` for iPhone 15 Pro Max).
- `problem_category_id`: ID of a created problem category for testing updates/deletes.

---

## 🚀 Endpoints

### 1. Create Problem Category (Root Level)
Assigns a top-level problem to a specific phone model.

- **Method**: `POST`
- **URL**: `{{base_url}}/problem-categories`
- **Permission**: `problem.category.create`
- **Body**:
```json
{
  "name_uz": "Yangi Muammo",
  "name_ru": "Новая Проблема",
  "name_en": "New Problem",
  "phone_category_id": "10000000-0000-0000-0000-000000000002",
  "price": 50000,
  "estimated_minutes": 30
}
```
> **Note**: `phone_category_id` is required for root-level problems. You cannot provide both `phone_category_id` and `parent_id`.

### 2. Create Problem Category (Child Level)
Creates a sub-category under an existing problem.

- **Method**: `POST`
- **URL**: `{{base_url}}/problem-categories`
- **Body**:
```json
{
  "name_uz": "Ichki Muammo",
  "name_ru": "Подпроблема",
  "name_en": "Sub-problem",
  "parent_id": "20000000-0000-0000-0000-000000000001",
  "price": 75000,
  "estimated_minutes": 45
}
```

### 3. Get Root Problems
Fetches top-level problems mapped to a specific phone category.

- **Method**: `GET`
- **URL**: `{{base_url}}/problem-categories?phone_category_id=10000000-0000-0000-0000-000000000002`
- **Query Params**:
    - `phone_category_id` (Required): The ID of the phone model.
    - `search` (Optional): Filter by name.
    - `limit` (Optional): Default 20.
    - `offset` (Optional): Default 0.

### 4. Get Child Problems (with Breadcrumb)
Fetches sub-problems of a specific category and returns the hierarchy breadcrumb.

- **Method**: `GET`
- **URL**: `{{base_url}}/problem-categories?parent_id=20000000-0000-0000-0000-000000000001`
- **Query Params**:
    - `parent_id` (Required): The ID of the parent problem.

### 5. Update Problem Category
- **Method**: `PATCH`
- **URL**: `{{base_url}}/problem-categories/:id`
- **Permission**: `problem.category.update`
- **Body**:
```json
{
  "name_en": "Updated Problem Name",
  "price": 120000,
  "is_active": true
}
```

### 6. Update Sort Order
Changes the display position of the category.

- **Method**: `PATCH`
- **URL**: `{{base_url}}/problem-categories/:id/sort`
- **Permission**: `problem.category.update`
- **Body**:
```json
{
  "sort": 5
}
```

### 7. Delete Problem Category
Performs a soft delete (`status: 'Deleted'`).

- **Method**: `DELETE`
- **URL**: `{{base_url}}/problem-categories/:id`
- **Permission**: `problem.category.delete`
> **Warning**: Cannot delete if the category has children.

---

## 💡 Pro-Tips for Postman

### Auto-Set Problem ID
In the **Tests** tab of your "Create Problem Category" request, add:
```javascript
const response = pm.response.json();
if (response.id) {
    pm.environment.set("problem_category_id", response.id);
}
```

### Validation Checklist
1. **Name Conflict**: Try creating a problem with a name that already exists under the same parent. Should return `400 Bad Request`.
2. **Invalid Hierarchy**: Try providing both `phone_category_id` and `parent_id`. Should return `400 Bad Request`.
3. **Inactive Parent**: Try creating a child under an inactive parent. Should return `400 Bad Request`.
4. **Delete with Children**: Try deleting a category that has sub-problems. Should return `400 Bad Request`.
