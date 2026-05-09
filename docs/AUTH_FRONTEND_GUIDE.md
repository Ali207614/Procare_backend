# 🔐 Authentication Module (Admin) - Frontend Guide

This documentation provides a comprehensive guide for frontend developers to integrate with the Authentication module for Administrators.

## 🛠 Prerequisites

- **Base URL**: `{{base_url}}/auth/admin`
- **Authentication**: JWT-based. Protected endpoints require a Bearer token in the `Authorization` header.
- **Language Support**: SMS messages and error localizations support `uz` and `ru`.

---

## 🏗 Authentication Flows

### 1. Registration Flow (Admin)
Used for admins who are already in the system (status `Pending`) but haven't set their password or verified their phone.

#### Step 1: Send Verification Code
Sends a 6-digit OTP to the admin's phone number.

- **Method**: `POST`
- **URL**: `/send-code`
- **Body**:
```json
{
  "phone_number": "+998901234567",
  "language": "uz" 
}
```
- **Response (201)**:
```json
{
  "message": "Verification code sent successfully",
  "expires_in": 300,
  "expires_at": "2024-03-20T10:05:00.000Z",
  "retry_after": 60,
  "code": "123456" // ONLY returned in non-production environments
}
```

#### Step 2: Verify Code
Verifies the OTP received via SMS.

- **Method**: `POST`
- **URL**: `/verify-code`
- **Body**:
```json
{
  "phone_number": "+998901234567",
  "code": "123456"
}
```

#### Step 3: Complete Registration
Sets the password and completes the registration process.

- **Method**: `POST`
- **URL**: `/register`
- **Body**:
```json
{
  "phone_number": "+998901234567",
  "password": "securepassword123",
  "confirm_password": "securepassword123"
}
```
- **Response (201)**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR..."
}
```

---

### 2. Login Flow
Standard login for registered admins.

- **Method**: `POST`
- **URL**: `/login`
- **Body**:
```json
{
  "phone_number": "+998901234567",
  "password": "securepassword123"
}
```
- **Response (200)**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR..."
}
```

---

### 3. Forgot Password Flow
Used when an admin forgets their password.

#### Step 1: Request Reset OTP
- **Method**: `POST`
- **URL**: `/forgot-password`
- **Body**:
```json
{
  "phone_number": "+998901234567"
}
```

#### Step 2: Verify Reset OTP
Returns a temporary `reset_token` valid for 10 minutes.

- **Method**: `POST`
- **URL**: `/verify-forgot-password-otp`
- **Body**:
```json
{
  "phone_number": "+998901234567",
  "code": "123456"
}
```
- **Response (200)**:
```json
{
  "message": "OTP verified successfully",
  "reset_token": "d290f1ee-6c54-4b01-90e6-d701748f0851"
}
```

#### Step 3: Reset Password
Uses the `reset_token` to set a new password.

- **Method**: `POST`
- **URL**: `/reset-password`
- **Body**:
```json
{
  "phone_number": "+998901234567",
  "reset_token": "d290f1ee-6c54-4b01-90e6-d701748f0851",
  "new_password": "NewSecurePassword123",
  "confirm_new_password": "NewSecurePassword123"
}
```

---

### 4. Logout
Invalidates the current session and blacklists the token.

- **Method**: `POST`
- **URL**: `/logout`
- **Headers**:
    - `Authorization`: `Bearer {{access_token}}`

---

## 🚨 Error Handling

The API returns structured error responses to help the frontend display specific messages.

### Standard Error Format
```json
{
  "statusCode": 400,
  "message": "Error message description",
  "location": "error_code_identifier"
}
```

### Common `location` Codes

| Location Code | Description | HTTP Status |
| :--- | :--- | :--- |
| `invalid_phone` | Phone number format is incorrect. | 400 |
| `invalid_code` | The OTP provided is incorrect or expired. | 400 |
| `confirm_password` | Passwords do not match. | 400 |
| `admin_not_found` | No admin found with this phone number. | 404 |
| `already_registered` | Admin is already registered or cannot perform this action. | 409 |
| `incomplete_registration` | Admin must finish registration before logging in. | 403 |
| `invalid_login` | Incorrect phone number or password. | 401 |
| `auth_send_code_rate_limit`| Too many OTP requests. Check `retry_after` field. | 429 |
| `sms_send_failed` | External SMS service failure. | 503 |
| `invalid_reset_token` | The password reset token is invalid or expired. | 400 |

---

## ⚙️ Environment Notes

### Non-Production Behavior (Development/Staging)
To facilitate testing without physical SIM cards:
1.  **OTP Visibility**: The `send-code` and `forgot-password` endpoints return the generated `code` in the response body.
2.  **Rate Limiting**: Rate limits are still active but easier to monitor via the `retry_after` response field.

### Production Behavior
1.  **OTP**: The `code` field is **NOT** included in any API response. It must be received via SMS.
2.  **Security**: All passwords are encrypted using Bcrypt (10 rounds). Tokens are valid for 1 day.
