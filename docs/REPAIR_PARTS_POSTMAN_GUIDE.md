# Repair Parts API Testing Guide

This guide provides instructions for testing the **Repair Parts** module API endpoints using Postman.

## 📋 Prerequisites

- **Admin Authentication**: Most endpoints require a valid JWT token from an administrator.
- **Base URL**: Ensure your Postman environment has the `base_url` variable set (e.g., `http://localhost:3000`).
- **Required Roles/Permissions**: Testing specialized endpoints (Create, Update, Delete, Assign) requires specific permissions.

---

## 🔐 Authentication & Permissions

Add the following header to all requests:
- **Authorization**: `Bearer {{admin_token}}`

### Required Permissions
- `repair.part.create`: Required for creating parts.
- `repair.part.update`: Required for updating parts.
- `repair.part.delete`: Required for deleting parts.
- `repair.part.assign`: Required for assigning parts to problem categories.

---

## 🏗 Environment Variables

| Variable | Description | Example |
| :--- | :--- | :--- |
| `base_url` | API Base URL | `http://localhost:3000` |
| `admin_token` | Admin JWT Token | `eyJhbGci...` |
| `repair_part_id` | UUID of a repair part | `30000000-0000-0000-0000-000000000001` |
| `problem_category_id` | UUID of a problem category | `a9f3294b-8353-4e84-a259-fcb1f34ea58c` |

---

## 🚀 Endpoints

### 1. Create a New Repair Part
**Method**: `POST`  
**URL**: `{{base_url}}/repair-parts`  
**Permission**: `repair.part.create`

**Request Body (JSON)**:
```json
{
  "part_name_uz": "iPhone 15 Pro Max Batareya (Original)",
  "part_name_ru": "Батарея iPhone 15 Pro Max (Оригинал)",
  "part_name_en": "iPhone 15 Pro Max Battery (Original)",
  "part_price": 550000,
  "quantity": 25,
  "description_uz": "Original sifatli batareya",
  "description_ru": "Аккумулятор оригинального качества",
  "description_en": "Original quality battery"
}
```

---

### 2. Get All Repair Parts (Paginated)
**Method**: `GET`  
**URL**: `{{base_url}}/repair-parts`

**Query Parameters**:
- `limit`: (Optional) Items per page (Default: 10).
- `offset`: (Optional) Offset for pagination (Default: 0).
- `search`: (Optional) Filter by part name (UZ, RU, or EN).
- `status`: (Optional) `Open` or `Deleted`.
- `problem_category_ids[]`: (Optional) Filter by problem category IDs.
- `exclude_problem_category_ids[]`: (Optional) Exclude parts assigned to these category IDs.

**Example URL with Filters**:
`{{base_url}}/repair-parts?search=Screen&limit=20&status=Open`

---

### 3. Get a Single Repair Part
**Method**: `GET`  
**URL**: `{{base_url}}/repair-parts/:id`

**Example URL**:
`{{base_url}}/repair-parts/30000000-0000-0000-0000-000000000001`

---

### 4. Update an Existing Repair Part
**Method**: `PUT`  
**URL**: `{{base_url}}/repair-parts/:id`  
**Permission**: `repair.part.update`

**Request Body (JSON)**:
```json
{
  "part_price": 2600000,
  "quantity": 10,
  "description_en": "Updated price for iPhone 15 Pro Max Screen"
}
```

---

### 5. Assign Repair Parts to Problem Category
**Method**: `PUT`  
**URL**: `{{base_url}}/repair-parts/assignments`  
**Permission**: `repair.part.assign`

**Description**: This endpoint replaces all existing assignments for a specific problem category with the provided list.

**Request Body (JSON)**:
```json
{
  "problem_category_id": "a9f3294b-8353-4e84-a259-fcb1f34ea58c",
  "repair_parts": [
    {
      "id": "30000000-0000-0000-0000-000000000001",
      "is_required": true
    },
    {
      "id": "30000000-0000-0000-0000-000000000005",
      "is_required": false
    }
  ]
}
```

---

### 6. Delete a Repair Part (Soft Delete)
**Method**: `DELETE`  
**URL**: `{{base_url}}/repair-parts/:id`  
**Permission**: `repair.part.delete`

**Description**: Deletes the part by setting its status to `Deleted`.

---

## 💡 Postman Pro-Tips

### Save ID from Response
In the **Tests** tab of your "Create Repair Part" or "Get All" request, add the following script to automatically update your environment variables:

```javascript
const jsonData = pm.response.json();
if (jsonData.id) {
    pm.environment.set("repair_part_id", jsonData.id);
} else if (jsonData.rows && jsonData.rows.length > 0) {
    pm.environment.set("repair_part_id", jsonData.rows[0].id);
}
```

### Validate Unique Names
If you try to create or update a part with a name that already exists (even in a different language), the API will return a `400 Bad Request` with:
```json
{
  "message": "Part name (UZ/RU/EN) must be unique",
  "location": "part_name"
}
```
