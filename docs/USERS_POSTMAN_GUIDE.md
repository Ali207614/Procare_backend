# 👥 Users Module Postman Testing Guide

This guide provides instructions for testing the Users (Clients) API endpoints.

## 🛠 Prerequisites

- **Base URL**: `{{base_url}}` (e.g., `http://localhost:3000`)
- **Admin Token**: A valid JWT token for an Admin. Set this as a Bearer token in the `Authorization` header.
- **Permissions**:
    - `user.create`: Required to create a new user.
    - `user.update`: Required to update an existing user.
    - `user.delete`: Required to delete a user.

---

## 🏗 Environment Variables

Ensure the following variables are set in your Postman environment:
- `base_url`: `http://localhost:3000`
- `admin_token`: `your_jwt_admin_token`
- `user_id`: `a_valid_user_uuid` (can be set automatically from the "Find All Users" response)

---

## 📡 Endpoints

### 1. Create New User
Creates a new client in the system.

- **Method**: `POST`
- **URL**: `{{base_url}}/users`
- **Headers**:
    - `Authorization`: `Bearer {{admin_token}}`
    - `Content-Type`: `application/json`
- **Permission**: `user.create`
- **Request Body**:
```json
{
  "first_name": "Akmal",
  "last_name": "Karimov",
  "phone_number1": "+998901234567",
  "phone_number2": "+998911234567",
  "passport_series": "AB1234567",
  "birth_date": "1990-01-01",
  "id_card_number": "3000000001",
  "language": "uz",
  "telegram_chat_id": "123456789",
  "telegram_username": "akmal_karimov",
  "source": "web",
  "is_active": true,
  "status": "Open"
}
```
- **Notes**: `phone_number1` must be unique and follow the Uzbek format `+998XXXXXXXXX`.

### 2. Get All Users (with Search & Pagination)
Retrieves a list of users with filtering and pagination.

- **Method**: `GET`
- **URL**: `{{base_url}}/users`
- **Headers**:
    - `Authorization`: `Bearer {{admin_token}}`
- **Query Parameters**:
    - `offset`: `0` (default)
    - `limit`: `20` (default)
    - `search`: `Akmal` (optional: searches by name, phone, passport, etc.)
    - `status_ids`: `Open` (optional: array/multiple allowed)
    - `source`: `web` (optional: `telegram_bot`, `employee`, `web`, `app`, `other`)
    - `has_telegram`: `true` (optional: `true` or `false`)
    - `language`: `uz` (optional: `uz`, `ru`, `en`)
- **Postman "Tests" Script** (to set `user_id` automatically):
```javascript
const response = pm.response.json();
if (response.rows && response.rows.length > 0) {
    pm.environment.set("user_id", response.rows[0].id);
}
```

### 3. Find User with Orders
Retrieves a specific user's details along with their repair order history.

- **Method**: `GET`
- **URL**: `{{base_url}}/users/{{user_id}}`
- **Headers**:
    - `Authorization`: `Bearer {{admin_token}}`

### 4. Update User
Updates an existing user's information.

- **Method**: `PATCH`
- **URL**: `{{base_url}}/users/{{user_id}}`
- **Headers**:
    - `Authorization`: `Bearer {{admin_token}}`
    - `Content-Type`: `application/json`
- **Permission**: `user.update`
- **Request Body**:
```json
{
  "first_name": "Akmal (Updated)",
  "last_name": "Karimov",
  "phone_number1": "+998901234567",
  "language": "ru"
}
```
- **Notes**: Only users with `status: 'Open'` can be updated.

### 5. Soft Delete User
Marks a user as deleted and deactivates them.

- **Method**: `DELETE`
- **URL**: `{{base_url}}/users/{{user_id}}`
- **Headers**:
    - `Authorization`: `Bearer {{admin_token}}`
- **Permission**: `user.delete`
- **Notes**: This is a soft delete; it sets the status to `Deleted` and `is_active` to `false`. Only users with `status: 'Open'` can be deleted.

---

## 💡 Pro-Tips

- **Search**: The `search` parameter is very powerful; it checks `first_name`, `last_name`, `phone_number1`, `phone_number2`, `passport_series`, `id_card_number`, and `telegram_username`.
- **Validation**: If you receive a `400 Bad Request`, check the `location` field in the response for which property failed validation.
- **Seed Data**: After running `npm run seed`, you will have 100 realistic users to test with.
