# Calculator API - Frontend Integration Guide

This guide provides documentation for the Calculator API, which allows users to estimate repair costs by selecting their device's operating system, model, and specific problem.

## Base URL
`{{base_url}}/calculator`

## Overview Flow
1.  **Step 1**: Fetch active OS types (iOS, Android, etc.).
2.  **Step 2**: Fetch root phone categories (Brands like Apple, Samsung) for the selected OS.
3.  **Step 3**: (Optional) Fetch sub-categories (Series/Models like iPhone 15, Galaxy S series) until `has_children` is `false`.
4.  **Step 4**: Fetch problem categories (Repairs like Screen Replacement) for the selected phone category.

---

## Endpoints

### 1. Get OS Types
Retrieves a list of all active operating system types.

-   **Method**: `GET`
-   **URL**: `{{base_url}}/calculator/os-types`
-   **Auth Required**: No

**Response Example**:
```json
[
  {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name_uz": "iOS",
    "name_ru": "iOS",
    "name_en": "iOS",
    "sort": 1,
    "is_active": true,
    "status": "Open",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
]
```

---

### 2. Get Phone Categories
Retrieves phone categories (brands, series, or models) for a specific OS.

-   **Method**: `GET`
-   **URL**: `{{base_url}}/calculator/phone-categories/:os_type_id`
-   **Auth Required**: No
-   **Query Parameters**:
    -   `parent_id`: (Optional) Use this to navigate into sub-categories (e.g., from Apple to iPhone 15).

**Logic**:
-   If `parent_id` is NOT provided: Returns root categories (Brands) for that OS.
-   If `parent_id` IS provided: Returns children of that category.
-   **Important Flags**:
    -   `has_children`: If `true`, you should call this endpoint again using this category's `id` as the `parent_id`.
    -   `has_problems`: If `true`, you can proceed to Step 4 (Get Problem Categories) for this category.

**Response Example**:
```json
[
  {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name_uz": "iPhone 15 Pro",
    "name_ru": "iPhone 15 Pro",
    "name_en": "iPhone 15 Pro",
    "telegram_sticker": "📱",
    "phone_os_type_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "parent_id": "...",
    "sort": 1,
    "has_children": false,
    "has_problems": true
  }
]
```

---

### 3. Get Problem Categories
Retrieves potential problems and their calculated costs for a specific phone category.

-   **Method**: `GET`
-   **URL**: `{{base_url}}/calculator/problem-categories/:phone_category_id`
-   **Auth Required**: No

**Response Detail**:
-   `price`: The base service cost for the repair.
-   `cost`: The **total estimated cost**, which includes the base price plus any mandatory repair parts (e.g., the cost of the screen itself). **Frontend should display this value to the user.**
-   `estimated_minutes`: Estimated time required for the repair.

**Response Example**:
```json
[
  {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name_uz": "Ekran almashtirish",
    "name_ru": "Замена экрана",
    "name_en": "Screen replacement",
    "parent_id": null,
    "price": "100000.00",
    "cost": "1550000.00",
    "estimated_minutes": 60,
    "sort": 1
  }
]
```

---

## Data Models (DTOs)

### OsTypeResponseDto
| Property | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Unique identifier |
| `name_uz` | string | Name in Uzbek |
| `name_ru` | string | Name in Russian |
| `name_en` | string | Name in English |

### PhoneCategoryResponseDto
| Property | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Unique identifier |
| `name_uz` | string | Name in Uzbek |
| `has_children` | boolean | If true, navigate deeper using `parent_id` |
| `has_problems` | boolean | If true, fetch problems for this category |

### ProblemCategoryResponseDto
| Property | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Unique identifier |
| `name_uz` | string | Name in Uzbek |
| `price` | string | Base service fee |
| `cost` | string | **Total price for user (service + parts)** |
| `estimated_minutes` | number | Duration in minutes |

---

## Implementation Tips

1.  **Localization**: Always use the `name_uz`, `name_ru`, or `name_en` fields based on the user's selected language.
2.  **Formatting Costs**: The `price` and `cost` fields are returned as strings (to preserve decimal precision). Ensure you format them with thousands separators (e.g., `1 550 000`) before displaying.
3.  **Recursive Selection**: Some devices might have multiple levels of categories (Brand -> Series -> Model). Always check `has_children` before showing the problem list.
