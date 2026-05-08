# 🛠 Permissions API Testing Guide

This guide provides instructions for testing the **Permissions** API endpoints using Postman. This module is used to retrieve the list of system permissions, which are typically used when configuring roles.

## 📋 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Variables](#environment-variables)
3. [Authentication](#authentication)
4. [Endpoints](#endpoints)
    - [List All Permissions](#list-all-permissions)
5. [Common Validations](#common-validations)

---

## 1. Prerequisites
- Access to an Admin account with the following permission:
    - `permission.view`
- A valid JWT Admin Token.

---

## 2. Environment Variables
Ensure the following variables are set in your Postman Environment:

| Variable | Description | Example Value |
| :--- | :--- | :--- |
| `base_url` | Base URL of the API | `http://localhost:5001/api/v1` |
| `admin_token` | JWT Token received after admin login | `eyJhbGci...` |

---

## 3. Authentication
All endpoints require a Bearer Token in the `Authorization` header.
- **Header**: `Authorization`
- **Value**: `Bearer {{admin_token}}`

---

## 4. Endpoints

### List All Permissions
Retrieve a list of all active permissions available in the system. This endpoint supports searching, pagination, and sorting.

- **Method**: `GET`
- **URL**: `{{base_url}}/permissions`
- **Query Params**:
    - `search`: `admin.manage` (Optional - searches in `name` and `description`)
    - `limit`: `20` (Optional - default: 20)
    - `offset`: `0` (Optional - default: 0)
    - `sort_by`: `name` (Optional - choices: `name`, `description`, `created_at`. Default: `name`)
    - `sort_order`: `asc` (Optional - choices: `asc`, `desc`. Default: `desc`)
- **Required Permission**: `permission.view`

---

## 5. Common Validations

| Case | Expected Error | Reason |
| :--- | :--- | :--- |
| No Token | `401 Unauthorized` | Missing or invalid `Authorization` header. |
| Forbidden | `403 Forbidden` | Admin does not have the `permission.view` permission. |
| Pagination | `200 OK` | Returns an empty array `[]` if no results are found or offset is too high. |

---

## 💡 Postman Tips

### Practical Filtering
- **Find all Admin management permissions**:
  `GET {{base_url}}/permissions?search=admin.manage`
- **List permissions by creation date (Newest first)**:
  `GET {{base_url}}/permissions?sort_by=created_at&sort_order=desc`

### Example Response
```json
[
  {
    "id": "00000000-0000-0000-0000-000000000069",
    "name": "permission.view",
    "description": "Ruxsatlarni ko'rish",
    "created_at": "2025-06-08T09:15:43.000Z"
  },
  {
    "id": "00000000-0000-0000-0000-000000000018",
    "name": "admin.manage.view",
    "description": "Adminlarni ko'rish",
    "created_at": "2025-06-08T09:15:43.000Z"
  }
]
```

### Scripting Recommendation
In the **Tests** tab, you can verify if the response is an array:
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Response is an array", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.be.an('array');
});
```
