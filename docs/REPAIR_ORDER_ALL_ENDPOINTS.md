# Complete Repair Order API Endpoints

> **Base URL:** `http://localhost:<PORT>/api/v1`
> **Auth:** All endpoints require `Authorization: Bearer <jwt_token>` (JwtAdminAuthGuard)

---

## Table of Contents

1. [Core Repair Orders](#1-core-repair-orders-repair-orderscontrollerts)
2. [Assign Admins](#2-assign-admins-assign-admincontrollerts)
3. [Comments](#3-comments-commentcontrollerts)
4. [Attachments](#4-attachments-attachmentscontrollerts)
5. [Delivery](#5-delivery-deliverycontrollerts)
6. [Pickup](#6-pickup-pickupcontrollerts)
7. [Rental Phone](#7-rental-phone-rental-phonecontrollerts)
8. [Repair Order Statuses](#8-repair-order-statuses-repair-order-statusescontrollerts)
9. [Repair Order Status Transitions](#9-repair-order-status-transitions)
10. [Repair Order Status Permissions](#10-repair-order-status-permissions)
11. [Repair Parts](#11-repair-parts)

---

## 1. Core Repair Orders (`repair-orders.controller.ts`)

**Controller:** `@Controller('repair-orders')`

### 1.1 Create Repair Order
| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/api/v1/repair-orders` |
| **Guards** | `JwtAdminAuthGuard`, `RepairOrderStatusExistGuard` |
| **DTO** | `CreateRepairOrderDto` |

**Payload:**
```json
{
  "user_id": "uuid (required)",
  "phone_category_id": "uuid (required)",
  "status_id": "uuid (required)",
  "priority": "Low | Medium | High | Highest (optional)",
  "admin_ids": ["uuid", "uuid"] ,
  "initial_problems": [
    {
      "problem_category_id": "uuid",
      "price": 100000,
      "estimated_minutes": 60,
      "parts": [
        { "id": "uuid", "part_price": 12000, "quantity": 1 }
      ]
    }
  ],
  "final_problems": [
    {
      "problem_category_id": "uuid",
      "price": 100000,
      "estimated_minutes": 60,
      "parts": [
        { "id": "uuid", "part_price": 12000, "quantity": 1 }
      ]
    }
  ],
  "comments": [
    { "text": "Device has water damage" }
  ],
  "pickup": {
    "lat": 41.2995,
    "long": 69.2401,
    "description": "Main office",
    "courier_id": "uuid (optional)"
  },
  "delivery": {
    "lat": 41.2995,
    "long": 69.2401,
    "description": "Main office",
    "courier_id": "uuid (optional)"
  },
  "rental_phone": {
    "rental_phone_id": "uuid",
    "is_free": true,
    "price": 50000,
    "currency": "UZS | USD | EUR",
    "notes": "Temporary replacement"
  }
}
```

---

### 1.2 Update Repair Order (General)
| | |
|---|---|
| **Method** | `PATCH` |
| **URL** | `/api/v1/repair-orders/:repair_order_id` |
| **Guards** | `JwtAdminAuthGuard` |
| **DTO** | `UpdateRepairOrderDto` |

**Payload:**
```json
{
  "user_id": "uuid (optional)",
  "status_id": "uuid (optional)",
  "phone_category_id": "uuid (optional)",
  "priority": "Low | Medium | High | Highest (optional)",
  "initial_problems": [
    {
      "problem_category_id": "uuid",
      "price": 100000,
      "estimated_minutes": 60
    }
  ],
  "final_problems": [
    {
      "problem_category_id": "uuid",
      "price": 100000,
      "estimated_minutes": 60
    }
  ]
}
```

---

### 1.3 Get All Repair Orders by Branch
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/v1/repair-orders?branch_id=<uuid>` |
| **Guards** | `JwtAdminAuthGuard`, `BranchExistGuard` |
| **DTO** | `FindAllRepairOrdersQueryDto` |

**Query Parameters:**
| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `branch_id` | UUID | ✅ | — | Branch ID |
| `offset` | int | ❌ | 0 | Pagination offset |
| `limit` | int | ❌ | 20 | Pagination limit |
| `sort_by` | string | ❌ | `sort` | `sort`, `priority`, `created_at`, `updated_at` |
| `sort_order` | string | ❌ | `asc` | `asc`, `desc` |
| `source_types` | string[] | ❌ | — | `Organic`, `App`, `Meta`, `Web`, `Bot`, `Other` |
| `priorities` | string[] | ❌ | — | `Low`, `Medium`, `High`, `Highest` |
| `customer_name` | string | ❌ | — | Search by customer name |
| `phone_number` | string | ❌ | — | Search by phone number |
| `device_model` | string | ❌ | — | Search by device model |
| `order_number` | string | ❌ | — | Search by order number |
| `delivery_methods` | string[] | ❌ | — | `Self`, `Delivery` |
| `pickup_methods` | string[] | ❌ | — | `Self`, `Pickup` |
| `assigned_admin_ids` | UUID[] | ❌ | — | Filter by assigned admin IDs |
| `date_from` | ISO 8601 | ❌ | — | Created date from |
| `date_to` | ISO 8601 | ❌ | — | Created date to |

---

### 1.4 Get Repair Order by ID
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/v1/repair-orders/:repair_order_id` |
| **Guards** | `JwtAdminAuthGuard` |

---

### 1.5 Move Repair Order (Change Status)
| | |
|---|---|
| **Method** | `PATCH` |
| **URL** | `/api/v1/repair-orders/:repair_order_id/move` |
| **Guards** | `JwtAdminAuthGuard`, `RepairOrderStatusExistGuard` |
| **DTO** | `MoveRepairOrderDto` |

**Payload:**
```json
{
  "status_id": "uuid (required)",
  "sort": 10
}
```

---

### 1.6 Update Sort Order
| | |
|---|---|
| **Method** | `PATCH` |
| **URL** | `/api/v1/repair-orders/:repair_order_id/sort` |
| **Guards** | `JwtAdminAuthGuard` |
| **DTO** | `UpdateRepairOrderSortDto` |

**Payload:**
```json
{
  "sort": 10
}
```

---

### 1.7 Delete Repair Order (Soft Delete)
| | |
|---|---|
| **Method** | `DELETE` |
| **URL** | `/api/v1/repair-orders/:repair_order_id` |
| **Guards** | `JwtAdminAuthGuard` |

---

### 1.8 Update Client Info
| | |
|---|---|
| **Method** | `PATCH` |
| **URL** | `/api/v1/repair-orders/:repair_order_id/client` |
| **Guards** | `JwtAdminAuthGuard` |
| **DTO** | `UpdateClientInfoDto` |

**Payload:**
```json
{
  "first_name": "John (optional, max 100)",
  "last_name": "Doe (optional, max 100)",
  "phone": "+998901234567 (optional, international format)"
}
```

---

### 1.9 Update Product Info
| | |
|---|---|
| **Method** | `PATCH` |
| **URL** | `/api/v1/repair-orders/:repair_order_id/product` |
| **Guards** | `JwtAdminAuthGuard` |
| **DTO** | `UpdateProductDto` |

**Payload:**
```json
{
  "phone_category_id": "uuid (optional)",
  "imei": "string (optional, max 100)"
}
```

---

### 1.10 Update Problem
| | |
|---|---|
| **Method** | `PATCH` |
| **URL** | `/api/v1/repair-orders/:repair_order_id/problems/:problem_id` |
| **Guards** | `JwtAdminAuthGuard` |
| **DTO** | `UpdateProblemDto` |

**Payload:**
```json
{
  "problem_category_id": "uuid (optional)",
  "price": 100000,
  "estimated_minutes": 60,
  "parts": ["uuid", "uuid"]
}
```

---

### 1.11 Transfer Branch
| | |
|---|---|
| **Method** | `PATCH` |
| **URL** | `/api/v1/repair-orders/:repair_order_id/transfer-branch` |
| **Guards** | `JwtAdminAuthGuard` |
| **DTO** | `TransferBranchDto` |

**Payload:**
```json
{
  "new_branch_id": "uuid (required)"
}
```

---

## 2. Assign Admins (`assign-admin.controller.ts`)

**Controller:** `@Controller('repair-orders/:repair_order_id/assign-admins')`

### 2.1 Assign Admins to Order
| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/api/v1/repair-orders/:repair_order_id/assign-admins` |
| **Guards** | `JwtAdminAuthGuard` |
| **DTO** | `AssignAdminsDto` |

**Payload:**
```json
{
  "admin_ids": ["uuid", "uuid"]
}
```

---

### 2.2 Remove Single Admin from Order
| | |
|---|---|
| **Method** | `DELETE` |
| **URL** | `/api/v1/repair-orders/:repair_order_id/assign-admins/:admin_id` |
| **Guards** | `JwtAdminAuthGuard` |

---

### 2.3 Remove Multiple Admins from Order
| | |
|---|---|
| **Method** | `DELETE` |
| **URL** | `/api/v1/repair-orders/:repair_order_id/assign-admins` |
| **Guards** | `JwtAdminAuthGuard` |
| **DTO** | `RemoveAdminsDto` |

**Payload:**
```json
{
  "admin_ids": ["uuid", "uuid"]
}
```

---

## 3. Comments (`comment.controller.ts`)

**Controller:** `@Controller()` (uses full route paths inline)

### 3.1 Create Comment
| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/api/v1/repair-orders/:repair_order_id/comments` |
| **Guards** | `JwtAdminAuthGuard` |
| **DTO** | `CreateCommentDto` |

**Payload:**
```json
{
  "text": "Device has water damage (max 1000 chars)"
}
```

---

### 3.2 Update Comment
| | |
|---|---|
| **Method** | `PATCH` |
| **URL** | `/api/v1/comments/:comment_id` |
| **Guards** | `JwtAdminAuthGuard` |
| **DTO** | `CreateCommentDto` |

**Payload:**
```json
{
  "text": "Updated comment text (max 1000 chars)"
}
```

---

### 3.3 Delete Comment
| | |
|---|---|
| **Method** | `DELETE` |
| **URL** | `/api/v1/comments/:comment_id` |
| **Guards** | `JwtAdminAuthGuard` |

---

## 4. Attachments (`attachments.controller.ts`)

**Controller:** `@Controller('repair-orders')`

### 4.1 Upload Attachment
| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/api/v1/repair-orders/:repair_order_id/attachments` |
| **Guards** | `JwtAdminAuthGuard` |
| **Content-Type** | `multipart/form-data` |

**Form Fields:**
| Field | Type | Required | Description |
|---|---|---|---|
| `file` | File | ✅ | The file to upload |
| `description` | string | ❌ | File description |

---

### 4.2 Get All Attachments
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/v1/repair-orders/:repair_order_id/attachments` |
| **Guards** | `JwtAdminAuthGuard` |

---

### 4.3 Delete Attachment
| | |
|---|---|
| **Method** | `DELETE` |
| **URL** | `/api/v1/repair-orders/:repair_order_id/attachments/:attachment_id` |
| **Guards** | `JwtAdminAuthGuard` |

---

## 5. Delivery (`delivery.controller.ts`)

**Controller:** `@Controller('repair-orders/:repair_order_id/delivery')`

### 5.1 Create Delivery
| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/api/v1/repair-orders/:repair_order_id/delivery` |
| **Guards** | `JwtAdminAuthGuard` |
| **DTO** | `CreateOrUpdateDeliveryDto` |

**Payload:**
```json
{
  "lat": 41.2995,
  "long": 69.2401,
  "description": "Office address (max 1000 chars)",
  "courier_id": "uuid (optional)"
}
```

---

### 5.2 Update Delivery
| | |
|---|---|
| **Method** | `PATCH` |
| **URL** | `/api/v1/repair-orders/:repair_order_id/delivery/:delivery_id` |
| **Guards** | `JwtAdminAuthGuard` |
| **DTO** | `CreateOrUpdateDeliveryDto` |

**Payload:** Same as Create Delivery

---

### 5.3 Delete Delivery
| | |
|---|---|
| **Method** | `DELETE` |
| **URL** | `/api/v1/repair-orders/:repair_order_id/delivery/:delivery_id` |
| **Guards** | `JwtAdminAuthGuard` |

---

## 6. Pickup (`pickup.controller.ts`)

**Controller:** `@Controller('repair-orders/:repair_order_id/pickup')`

### 6.1 Create Pickup
| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/api/v1/repair-orders/:repair_order_id/pickup` |
| **Guards** | `JwtAdminAuthGuard` |
| **DTO** | `CreateOrUpdatePickupDto` |

**Payload:**
```json
{
  "lat": 41.2995,
  "long": 69.2401,
  "description": "Pickup address (max 1000 chars)",
  "courier_id": "uuid (optional)"
}
```

---

### 6.2 Update Pickup
| | |
|---|---|
| **Method** | `PATCH` |
| **URL** | `/api/v1/repair-orders/:repair_order_id/pickup/:pickup_id` |
| **Guards** | `JwtAdminAuthGuard` |
| **DTO** | `CreateOrUpdatePickupDto` |

**Payload:** Same as Create Pickup

---

### 6.3 Delete Pickup
| | |
|---|---|
| **Method** | `DELETE` |
| **URL** | `/api/v1/repair-orders/:repair_order_id/pickup/:pickup_id` |
| **Guards** | `JwtAdminAuthGuard` |

---

## 7. Rental Phone (`rental-phone.controller.ts`)

**Controller:** `@Controller('repair-orders/:repair_order_id/rental-phone')`

### 7.1 Create Rental Phone
| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/api/v1/repair-orders/:repair_order_id/rental-phone` |
| **Guards** | `JwtAdminAuthGuard` |
| **DTO** | `CreateOrUpdateRentalPhoneDto` |

**Payload:**
```json
{
  "rental_phone_id": "uuid (required)",
  "is_free": true,
  "price": 50000,
  "currency": "UZS | USD | EUR",
  "notes": "Temporary replacement (max 1000 chars)"
}
```

---

### 7.2 Update Rental Phone (by order)
| | |
|---|---|
| **Method** | `PATCH` |
| **URL** | `/api/v1/repair-orders/:repair_order_id/rental-phone` |
| **Guards** | `JwtAdminAuthGuard` |
| **DTO** | `CreateOrUpdateRentalPhoneDto` |

**Payload:** Same as Create Rental Phone

---

### 7.3 Delete Rental Phone (by order)
| | |
|---|---|
| **Method** | `DELETE` |
| **URL** | `/api/v1/repair-orders/:repair_order_id/rental-phone` |
| **Guards** | `JwtAdminAuthGuard` |

---

### 7.4 Update Specific Rental Phone
| | |
|---|---|
| **Method** | `PATCH` |
| **URL** | `/api/v1/repair-orders/:repair_order_id/rental-phone/:rental_phone_id` |
| **Guards** | `JwtAdminAuthGuard` |
| **DTO** | `UpdateRentalPhoneDto` |

**Payload:**
```json
{
  "rental_phone_device_id": "uuid (optional)",
  "is_free": false,
  "rental_price": 50000,
  "price_per_day": 10000
}
```

---

### 7.5 Remove Specific Rental Phone
| | |
|---|---|
| **Method** | `DELETE` |
| **URL** | `/api/v1/repair-orders/:repair_order_id/rental-phone/:rental_phone_id` |
| **Guards** | `JwtAdminAuthGuard` |

---

## 8. Repair Order Statuses (`repair-order-statuses.controller.ts`)

**Controller:** `@Controller('repair-order-statuses')`

### 8.1 Get All Statuses
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/v1/repair-order-statuses?branch_id=<uuid>` |
| **Guards** | `JwtAdminAuthGuard`, `PermissionsGuard`, `BranchExistGuard` |
| **Permission** | `repair.order.status.view` |

**Query Parameters:** `branch_id` (required), `limit`, `offset`

---

### 8.2 Create Status
| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/api/v1/repair-order-statuses` |
| **Guards** | `JwtAdminAuthGuard`, `PermissionsGuard` |
| **Permission** | `repair.order.status.create` |
| **DTO** | `CreateRepairOrderStatusDto` |

---

### 8.3 Get Viewable Statuses
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/v1/repair-order-statuses/viewable?branch_id=<uuid>` |
| **Guards** | `JwtAdminAuthGuard`, `BranchExistGuard` |

**Query Parameters:** `branch_id` (required), `limit`, `offset`

---

### 8.4 Update Status Sort
| | |
|---|---|
| **Method** | `PATCH` |
| **URL** | `/api/v1/repair-order-statuses/:status_id/sort` |
| **Guards** | `JwtAdminAuthGuard`, `PermissionsGuard`, `RepairOrderStatusExistGuard` |
| **Permission** | `repair.order.status.update` |
| **DTO** | `UpdateRepairOrderStatusSortDto` |

---

### 8.5 Update Status
| | |
|---|---|
| **Method** | `PATCH` |
| **URL** | `/api/v1/repair-order-statuses/:status_id` |
| **Guards** | `JwtAdminAuthGuard`, `PermissionsGuard`, `RepairOrderStatusExistGuard` |
| **Permission** | `repair.order.status.update` |
| **DTO** | `UpdateRepairOrderStatusDto` |

---

### 8.6 Delete Status (Soft Delete)
| | |
|---|---|
| **Method** | `DELETE` |
| **URL** | `/api/v1/repair-order-statuses/:status_id` |
| **Guards** | `JwtAdminAuthGuard`, `PermissionsGuard`, `RepairOrderStatusExistGuard` |
| **Permission** | `repair.order.status.delete` |

---

## 9. Repair Order Status Transitions (`repair-order-status-transitions.controller.ts`)

**Controller:** `@Controller('repair-order-status-transitions')`

### 9.1 Upsert Transitions
| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/api/v1/repair-order-status-transitions/:status_id` |
| **Guards** | `JwtAdminAuthGuard`, `PermissionsGuard`, `RepairOrderStatusExistGuard` |
| **Permission** | `repair.status.transition` |
| **DTO** | `CreateRepairOrderStatusTransitionDto` |

---

### 9.2 Get All Transitions
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/v1/repair-order-status-transitions` |
| **Guards** | `JwtAdminAuthGuard` |

---

## 10. Repair Order Status Permissions (`repair-order-status-permissions.controller.ts`)

**Controller:** `@Controller('repair-order-status-permissions')`

### 10.1 Bulk Assign Permissions
| | |
|---|---|
| **Method** | `PUT` |
| **URL** | `/api/v1/repair-order-status-permissions/bulk-assign` |
| **Guards** | `JwtAdminAuthGuard`, `PermissionsGuard`, `BranchExistGuard` |
| **Permission** | `repair.status.permission` |
| **DTO** | `AssignRepairOrderStatusPermissionsDto` |

---

### 10.2 Get Permissions by Status
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/v1/repair-order-status-permissions/by-status/:status_id` |
| **Guards** | `JwtAdminAuthGuard`, `RepairOrderStatusExistGuard` |

---

### 10.3 Get Permission by Role & Status
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/v1/repair-order-status-permissions/by-role/:role_id/status/:status_id` |
| **Guards** | `JwtAdminAuthGuard`, `RepairOrderStatusExistGuard` |

---

### 10.4 Get Permissions by Role & Branch
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/v1/repair-order-status-permissions/by-role/:role_id/branch/:branch_id` |
| **Guards** | `JwtAdminAuthGuard`, `BranchExistGuard` |

---

## 11. Repair Parts (`repair-parts.controller.ts`)

**Controller:** `@Controller('repair-parts')`

### 11.1 Create Repair Part
| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/api/v1/repair-parts` |
| **Guards** | `JwtAdminAuthGuard`, `PermissionsGuard` |
| **Permission** | `repair.part.create` |
| **DTO** | `CreateRepairPartDto` |

---

### 11.2 Assign Parts to Problem Category
| | |
|---|---|
| **Method** | `PUT` |
| **URL** | `/api/v1/repair-parts/assignments` |
| **Guards** | `JwtAdminAuthGuard`, `PermissionsGuard` |
| **Permission** | `repair.part.assign` |
| **DTO** | `AssignRepairPartsToCategoryDto` |

---

### 11.3 Get All Repair Parts
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/v1/repair-parts` |
| **Guards** | `JwtAdminAuthGuard` |

**Query Parameters:** `FindAllPartsDto`

---

### 11.4 Get Repair Part by ID
| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/v1/repair-parts/:id` |
| **Guards** | `JwtAdminAuthGuard` |

---

### 11.5 Update Repair Part
| | |
|---|---|
| **Method** | `PUT` |
| **URL** | `/api/v1/repair-parts/:id` |
| **Guards** | `JwtAdminAuthGuard`, `PermissionsGuard` |
| **Permission** | `repair.part.update` |
| **DTO** | `UpdateRepairPartDto` |

---

### 11.6 Delete Repair Part (Soft Delete)
| | |
|---|---|
| **Method** | `DELETE` |
| **URL** | `/api/v1/repair-parts/:id` |
| **Guards** | `JwtAdminAuthGuard`, `PermissionsGuard` |
| **Permission** | `repair.part.delete` |

---

## Summary: UPDATE/MODIFY Endpoints Only

Below is a filtered list of **only the endpoints that update/modify** repair order data (PATCH, PUT, POST for adding sub-resources, DELETE for removing sub-resources):

| # | Method | URL | Description |
|---|---|---|---|
| 1 | `PATCH` | `/api/v1/repair-orders/:repair_order_id` | Update repair order (general) |
| 2 | `PATCH` | `/api/v1/repair-orders/:repair_order_id/move` | Move repair order to new status |
| 3 | `PATCH` | `/api/v1/repair-orders/:repair_order_id/sort` | Update sort order |
| 4 | `DELETE` | `/api/v1/repair-orders/:repair_order_id` | Soft delete repair order |
| 5 | `PATCH` | `/api/v1/repair-orders/:repair_order_id/client` | Update client info |
| 6 | `PATCH` | `/api/v1/repair-orders/:repair_order_id/product` | Update product info |
| 7 | `PATCH` | `/api/v1/repair-orders/:repair_order_id/problems/:problem_id` | Update a specific problem |
| 8 | `PATCH` | `/api/v1/repair-orders/:repair_order_id/transfer-branch` | Transfer to different branch |
| 9 | `POST` | `/api/v1/repair-orders/:repair_order_id/assign-admins` | Assign admins |
| 10 | `DELETE` | `/api/v1/repair-orders/:repair_order_id/assign-admins/:admin_id` | Remove single admin |
| 11 | `DELETE` | `/api/v1/repair-orders/:repair_order_id/assign-admins` | Remove multiple admins |
| 12 | `POST` | `/api/v1/repair-orders/:repair_order_id/comments` | Add comment |
| 13 | `PATCH` | `/api/v1/comments/:comment_id` | Update comment |
| 14 | `DELETE` | `/api/v1/comments/:comment_id` | Delete comment |
| 15 | `POST` | `/api/v1/repair-orders/:repair_order_id/attachments` | Upload attachment |
| 16 | `DELETE` | `/api/v1/repair-orders/:repair_order_id/attachments/:attachment_id` | Delete attachment |
| 17 | `POST` | `/api/v1/repair-orders/:repair_order_id/delivery` | Create delivery |
| 18 | `PATCH` | `/api/v1/repair-orders/:repair_order_id/delivery/:delivery_id` | Update delivery |
| 19 | `DELETE` | `/api/v1/repair-orders/:repair_order_id/delivery/:delivery_id` | Delete delivery |
| 20 | `POST` | `/api/v1/repair-orders/:repair_order_id/pickup` | Create pickup |
| 21 | `PATCH` | `/api/v1/repair-orders/:repair_order_id/pickup/:pickup_id` | Update pickup |
| 22 | `DELETE` | `/api/v1/repair-orders/:repair_order_id/pickup/:pickup_id` | Delete pickup |
| 23 | `POST` | `/api/v1/repair-orders/:repair_order_id/rental-phone` | Create rental phone |
| 24 | `PATCH` | `/api/v1/repair-orders/:repair_order_id/rental-phone` | Update rental phone (by order) |
| 25 | `DELETE` | `/api/v1/repair-orders/:repair_order_id/rental-phone` | Delete rental phone (by order) |
| 26 | `PATCH` | `/api/v1/repair-orders/:repair_order_id/rental-phone/:rental_phone_id` | Update specific rental phone |
| 27 | `DELETE` | `/api/v1/repair-orders/:repair_order_id/rental-phone/:rental_phone_id` | Remove specific rental phone |

### Configuration / Setup Endpoints (also affect repair order data):

| # | Method | URL | Description |
|---|---|---|---|
| 28 | `POST` | `/api/v1/repair-order-statuses` | Create status |
| 29 | `PATCH` | `/api/v1/repair-order-statuses/:status_id/sort` | Update status sort |
| 30 | `PATCH` | `/api/v1/repair-order-statuses/:status_id` | Update status |
| 31 | `DELETE` | `/api/v1/repair-order-statuses/:status_id` | Delete status |
| 32 | `POST` | `/api/v1/repair-order-status-transitions/:status_id` | Upsert transitions |
| 33 | `PUT` | `/api/v1/repair-order-status-permissions/bulk-assign` | Bulk assign permissions |
| 34 | `POST` | `/api/v1/repair-parts` | Create repair part |
| 35 | `PUT` | `/api/v1/repair-parts/assignments` | Assign parts to category |
| 36 | `PUT` | `/api/v1/repair-parts/:id` | Update repair part |
| 37 | `DELETE` | `/api/v1/repair-parts/:id` | Delete repair part |

---

**Total: 44 endpoints across 7 controllers + 4 configuration controllers**

- **Core repair order endpoints:** 11
- **Assign admin endpoints:** 3
- **Comment endpoints:** 3
- **Attachment endpoints:** 3
- **Delivery endpoints:** 3
- **Pickup endpoints:** 3
- **Rental phone endpoints:** 5
- **Status endpoints:** 6
- **Status transition endpoints:** 2
- **Status permission endpoints:** 4
- **Repair parts endpoints:** 6
