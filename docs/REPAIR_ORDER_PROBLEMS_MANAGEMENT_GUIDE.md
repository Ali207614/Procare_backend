# Repair Order Problems Management Guide (Initial & Final)

This guide provides frontend developers with the necessary details to manage **Initial Problems** and **Final Problems** within the Procare system.

---

## 1. Overview

In Procare, problems are categorized into two types:
- **Initial Problems:** The issues reported by the customer or diagnosed during the initial intake.
- **Final Problems:** The actual repairs performed and parts used. These are typically finalized before the device is delivered back to the customer.

Each problem is associated with a **Problem Category** (from the catalog) and can optionally include multiple **Repair Parts**.

---

## 2. Data Structure

### Problem Object (Input)
When creating or updating problems, use the following structure:

| Field | Type | Description |
| :--- | :--- | :--- |
| `problem_category_id` | `UUID` | ID from the problem categories catalog. |
| `price` | `number` | Service fee for this specific problem (excluding parts). |
| `estimated_minutes` | `number` | Time expected to fix this specific problem. |
| `parts` | `array` | List of parts used for this problem. |

### Part Object (Inside Problem)
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `UUID` | ID of the repair part from the catalog. |
| `part_price` | `number` | Custom price for the part for this specific order. |
| `quantity` | `number` | Quantity of the part used. |

---

## 3. Endpoints

### A. Creating a Repair Order with Problems
**`POST /api/v1/repair-orders`**

You can include arrays for both `initial_problems` and `final_problems` during creation.

```json
{
  "branch_id": "...",
  "phone_category_id": "...",
  "initial_problems": [
    {
      "problem_category_id": "d3e4b1cd-...",
      "price": 150000,
      "estimated_minutes": 45,
      "parts": [
        { "id": "7b2e2f60-...", "part_price": 200000, "quantity": 1 }
      ]
    }
  ]
}
```

### B. Syncing (Replacing) Problems
**`PATCH /api/v1/repair-orders/:repair_order_id`**

The `initial_problems` and `final_problems` fields in this endpoint work as **Sync/Replace**. 
- If you provide an array, **all existing problems of that type will be deleted** and replaced with the new list.
- To remove all problems of a type, send an empty array `[]`.
- If you omit the field, no changes are made to that problem type.

### C. Updating a Single Problem
**`PATCH /api/v1/repair-orders/:repair_order_id/problems/:problem_id`**

Use this to update details of one specific problem without affecting others in the list.

**Payload (`UpdateProblemDto`):**
```json
{
  "price": 120000,
  "estimated_minutes": 30,
  "parts": [ ... ] 
}
```
*Note: `parts` in this endpoint also acts as a replacement for the parts assigned to THIS specific problem.*

---

## 4. Retrieval (GET Response)

When fetching repair order details via **`GET /api/v1/repair-orders/:id`**, the problems are returned with full catalog details and localized names.

**Response Snippet:**
```json
{
  "initial_problems": [
    {
      "id": "...",
      "problem_category": {
        "id": "...",
        "name_uz": "Ekran sinishi",
        "name_ru": "Разбитый экран",
        "name_en": "Broken screen"
      },
      "price": "150000.00",
      "estimated_minutes": 45,
      "parts": [
        {
          "id": "...",
          "repair_part": {
            "name_uz": "iPhone 13 Display",
            "price": "180000.00",
            ...
          },
          "quantity": 1,
          "part_price": "200000.00"
        }
      ]
    }
  ]
}
```

---

## 5. Business Rules & Validation

1.  **Phone Category Requirement:** You cannot add problems to a repair order unless it has a `phone_category_id` assigned.
2.  **Catalog Mapping:**
    - A problem category can only be added if it is mapped to the device's `phone_category_id` in the system settings.
    - A repair part can only be added to a problem if that part is mapped to the chosen `problem_category_id`.
3.  **Unique Parts:** You cannot add the same part ID twice within the same problem.
4.  **Permissions:**
    - Managing `initial_problems` requires: `can_change_initial_problems`.
    - Managing `final_problems` requires: `can_change_final_problems`.
    - Updating a single problem requires generic `can_update` permission for the order.

---

## 6. Frontend Recommendations

- **Validation:** Always ensure `phone_category_id` is selected before opening the problem selection UI.
- **Dynamic Filtering:** When the user selects a problem category, filter the available parts based on the system's `repair_part_assignments`.
- **Totals:** The `total` field on the repair order is automatically recalculated by the backend based on the sum of all `price` fields in `final_problems` plus the cost of all parts (`part_price * quantity`).
