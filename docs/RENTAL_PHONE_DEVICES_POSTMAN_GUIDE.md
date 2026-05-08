# Rental Phone Devices API - Postman Guidance

This guide provides comprehensive instructions for testing the **Rental Phone Devices** module. This module manages devices available for rent to customers while their phones are being repaired.

## 🔑 Prerequisites

### 1. Authentication
All endpoints require a valid Admin JWT token.
- **Header**: `Authorization: Bearer {{admin_token}}`
- **Bulk Edit Format**:
  ```text
  Authorization:Bearer {{admin_token}}
  ```
- **Guard**: `JwtAdminAuthGuard`

### 2. Permissions
Ensure your admin account has the following permissions:
- `rental_phones_read`: To view devices and statistics.
- `rental_phones_create`: To add new devices.
- `rental_phones_update`: To edit devices or update quantities.
- `rental_phones_delete`: To (soft) delete devices.

---

## 🌐 Environment Variables
Add these to your Postman Environment:
- `base_url`: `http://localhost:3000/api/v1` (or your server URL)
- `admin_token`: Your active admin JWT token.
- `rental_phone_device_id`: UUID of a created device.
- `rental_phone_device_code`: Code of a created device (e.g., `RD001`).

---

## 🚀 Endpoints

### 1. List & Search Devices
Retrieve a paginated list of devices with advanced filtering.

- **Method**: `GET`
- **URL**: `{{base_url}}/rental-phone-devices`
- **Query Parameters**:
    - `search`: (Optional) Search by name, brand, model, code, or IMEI.
    - `brand`: (Optional) e.g., `Samsung`, `iPhone`.
    - `status`: (Optional) `Available`, `Rented`, `Maintenance`, `Lost`, `Damaged`, `Retired`.
    - `condition`: (Optional) `Excellent`, `Good`, `Fair`, `Poor`.
    - `is_available`: (Optional) `true` or `false`.
    - `is_free`: (Optional) `true` or `false`.
    - `min_price`: (Optional) Number.
    - `max_price`: (Optional) Number.
    - `currency`: (Optional) `UZS`, `USD`, `EUR`.
    - `offset`: (Optional) Default `0`.
    - `limit`: (Optional) Default `20`.
    - **Bulk Edit Format**:
      ```text
      search:
      brand:
      status:
      condition:
      is_available:
      is_free:
      min_price:
      max_price:
      currency:
      offset:0
      limit:20
      ```
- **Response Structure**:
```json
{
  "meta": {
    "total": 50,
    "limit": 20,
    "offset": 0
  },
  "data": [
    { ...device object... },
    { ...device object... }
  ]
}
```


### 2. Get Available Only
Fast access to devices ready for rent.

- **Method**: `GET`
- **URL**: `{{base_url}}/rental-phone-devices/available`

### 3. Get Statistics
Summary of inventory status and value.

- **Method**: `GET`
- **URL**: `{{base_url}}/rental-phone-devices/statistics`

### 4. Create Device
Add a new rental phone to the inventory.

- **Method**: `POST`
- **URL**: `{{base_url}}/rental-phone-devices`
- **Body** (JSON):
```json
{
  "code": "RD001",
  "name": "Samsung Galaxy A14",
  "brand": "Samsung",
  "model": "Galaxy A14",
  "imei": "351756061523456",
  "serial_number": "R2J505X0ABC",
  "color": "Black",
  "storage_capacity": "128GB",
  "is_free": false,
  "daily_rent_price": 25000,
  "deposit_amount": 100000,
  "currency": "UZS",
  "is_available": true,
  "status": "Available",
  "condition": "Good",
  "quantity": 5,
  "quantity_available": 5,
  "sort": 1,
  "notes": "With silicone case",
  "specifications": "{\"ram\":\"4GB\",\"camera\":\"50MP\"}"
}
```
- **Post-Request Script**:
```javascript
if (pm.response.code === 201) {
    const response = pm.response.json();
    pm.environment.set("rental_phone_device_id", response.id);
    pm.environment.set("rental_phone_device_code", response.code);
}
```

### 5. Update Device
Modify details of an existing device.

- **Method**: `PUT`
- **URL**: `{{base_url}}/rental-phone-devices/{{rental_phone_device_id}}`
- **Body** (JSON):
```json
{
  "name": "Samsung Galaxy A14 (Updated)",
  "daily_rent_price": 30000,
  "condition": "Excellent",
  "is_active": true
}
```

### 6. Update Quantity (Rent/Return)
Specifically used to increment or decrement the `quantity_available`.

- **Method**: `PATCH`
- **URL**: `{{base_url}}/rental-phone-devices/{{rental_phone_device_id}}/quantity`
- **Body** (JSON):
```json
{
  "quantityChange": -1
}
```
*Note: Negative values for renting out, positive for returns.*

### 7. Get by ID
- **Method**: `GET`
- **URL**: `{{base_url}}/rental-phone-devices/{{rental_phone_device_id}}`

### 8. Get by Code
- **Method**: `GET`
- **URL**: `{{base_url}}/rental-phone-devices/code/{{rental_phone_device_code}}`

### 9. Delete Device (Soft Delete)
Marks the device as inactive. It will no longer appear in search results.

- **Method**: `DELETE`
- **URL**: `{{base_url}}/rental-phone-devices/{{rental_phone_device_id}}`

---

## 🛠 Validation Rules

1.  **Uniqueness**: `code` and `imei` must be globally unique across all active devices.
2.  **Quantity Logic**:
    - `quantity_available` cannot exceed `quantity`.
    - `quantityChange` in PATCH must not result in `quantity_available < 0`.
3.  **Enums**:
    - `status`: `Available`, `Rented`, `Maintenance`, `Lost`, `Damaged`, `Retired`.
    - `condition`: `Excellent`, `Good`, `Fair`, `Poor`.
    - `currency`: `UZS`, `USD`, `EUR`.

## 💡 Testing Tips
1.  **Duplicate Test**: Try creating two devices with the same `code` to verify the `400 BadRequest` error.
2.  **Insufficient Stock**: Try to PATCH quantity with a change that would make it negative.
3.  **Pagination**: Set `limit=1` and `offset=1` to test paging logic.
