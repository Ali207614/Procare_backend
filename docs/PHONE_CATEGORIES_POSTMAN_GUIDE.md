# Phone Categories API - Postman Testing Guide

This guide provides instructions for testing the Phone Categories API endpoints. These endpoints manage the hierarchical structure of phone brands and models (e.g., Apple -> iPhone 15 Pro).

## Prerequisites

1.  **Auth Token**: All endpoints require a valid Admin JWT token.
2.  **Permissions**: The admin must have the following permissions:
    -   `phone.category.create` (for POST)
    -   `phone.category.update` (for PATCH)
    -   `phone.category.delete` (for DELETE)
3.  **OS Type ID**: Creation requires a valid `phone_os_type_id`.
4.  **Base URL**: `{{base_url}}/phone-categories`

---

## Environment Variables

| Variable | Description | Example Value |
| :--- | :--- | :--- |
| `base_url` | API Base URL | `http://localhost:3000` |
| `admin_token` | Admin JWT Token | `eyJhbGciOiJIUzI1...` |
| `os_type_id` | Phone OS Type ID | `10000000-0000-0000-0000-000000000001` (iOS) |
| `parent_id` | Parent Category ID (Brand) | `10000000-0000-0000-0000-000000000001` (Apple) |
| `category_id` | Specific Category ID | `10000000-0000-0000-0000-000000000002` (iPhone 15 Pro Max) |

---

## Endpoints

### 1. Find All Categories
Fetch categories with pagination, search, and filtering. By default, it returns root categories (brands).

-   **Method**: `GET`
-   **URL**: `{{base_url}}/phone-categories`
-   **Headers**:
    -   `Authorization: Bearer {{admin_token}}`
-   **Query Parameters**:
    -   `parent_id`: (Optional) Get sub-categories of this parent.
    -   `phone_os_type_id`: (Optional) Filter by OS type.
    -   `limit`: (Optional) Number of items per page.
    -   `offset`: (Optional) Number of items to skip.
    -   `search`: (Optional) Search by name (UZ, RU, EN).

**Example Response**:
```json
{
    "rows": [
        {
            "id": "10000000-0000-0000-0000-000000000001",
            "name_uz": "Apple",
            "name_ru": "Apple",
            "name_en": "Apple",
            "phone_os_type_id": "...",
            "parent_id": null,
            "sort": 1,
            "telegram_sticker": "🍎",
            "has_children": true,
            "has_problems": false,
            "breadcrumb": []
        }
    ],
    "total": 1,
    "limit": 20,
    "offset": 0
}
```

---

### 2. Create Category
Create a new phone brand (root) or model (sub-category).

-   **Method**: `POST`
-   **URL**: `{{base_url}}/phone-categories`
-   **Headers**:
    -   `Authorization: Bearer {{admin_token}}`
    -   `Content-Type: application/json`
-   **Body**:
```json
{
    "name_uz": "Google Pixel",
    "name_ru": "Google Pixel",
    "name_en": "Google Pixel",
    "phone_os_type_id": "{{os_type_id}}",
    "parent_id": null,
    "telegram_sticker": "📱",
    "is_active": true
}
```

---

### 3. Update Category
Modify existing category details.

-   **Method**: `PATCH`
-   **URL**: `{{base_url}}/phone-categories/{{category_id}}`
-   **Headers**:
    -   `Authorization: Bearer {{admin_token}}`
    -   `Content-Type: application/json`
-   **Body**:
```json
{
    "name_uz": "iPhone 15 Pro Max (Updated)",
    "is_active": false
}
```

---

### 4. Update Sort Order
Change the display order of a category within its hierarchy level.

-   **Method**: `PATCH`
-   **URL**: `{{base_url}}/phone-categories/{{category_id}}/sort`
-   **Headers**:
    -   `Authorization: Bearer {{admin_token}}`
    -   `Content-Type: application/json`
-   **Body**:
```json
{
    "sort": 1
}
```

---

### 5. Delete Category
Soft delete a category. 

-   **Method**: `DELETE`
-   **URL**: `{{base_url}}/phone-categories/{{category_id}}`
-   **Headers**:
    -   `Authorization: Bearer {{admin_token}}`

**Note**: You cannot delete a category if it has children or is linked to problems.

---

## Testing Scenarios

1.  **Hierarchical Navigation**:
    -   Call `GET /phone-categories` to get brands.
    -   Take a brand `id` (e.g., Apple) and call `GET /phone-categories?parent_id={{brand_id}}` to get models.
2.  **Duplicate Name Check**:
    -   Try to create a category with a name that already exists under the same parent. It should return a `400 Bad Request`.
3.  **Active Check**:
    -   Try to add a sub-category to an inactive parent. It should return a `400 Bad Request`.
4.  **Problem Constraint**:
    -   If a category is linked to problems, you cannot add children to it.
5.  **Search**:
    -   Use `?search=iphone` to test the search functionality across multiple languages.

## Postman Script Tips

**Post-request script for Login (if needed elsewhere)**:
```javascript
const response = pm.response.json();
if (response.access_token) {
    pm.environment.set("admin_token", response.access_token);
}
```
