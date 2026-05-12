# Service Forms API Documentation for Frontend Developers

This documentation provides a comprehensive guide for integrating the Service Forms API. These endpoints are used to manage service forms (receipts/acceptance forms) for repair orders, including generating PDF documents and retrieving stored data.

---

## Base Configuration

- **Base URL:** `/repair-orders/service-forms`
- **Authentication:** `Authorization: Bearer <Admin_JWT_Token>`
- **Content-Type:** `application/json`

---

## 1. Create/Update Service Form (SSE)
Generates a new service form PDF, uploads it to cloud storage (MinIO), and saves the form data. This endpoint uses **Server-Sent Events (SSE)** to provide real-time updates on the generation process. If a service form already exists for the given repair order, it will be replaced.

### Endpoint
`POST /repair-orders/service-forms/:repair_order_id/check-list`

### URL Parameters
| Parameter | Type | Description |
| :--- | :--- | :--- |
| `repair_order_id` | `UUID` | The unique identifier of the Repair Order. |

### Request Body (`CreateServiceFormDto`)
The request body requires detailed information about the device's state upon acceptance.

```json
{
  "pattern": [1, 2, 4, 5],
  "device_points": {
    "front": [{ "x": 0.25, "y": 0.4 }],
    "back": []
  },
  "form": {
    "date": "2026-05-12",
    "pin": "1234",
    "total_amount": 450000
  },
  "checklist": {
    "display": [{ "id": "screen-crack", "checked": true }],
    "body": [{ "id": "scratches", "checked": false }],
    "ports-1": [{ "id": "charging-port", "checked": true }],
    "ports": [],
    "other": []
  },
  "comments": "Minor scratch on the bottom left corner."
}
```

#### Field Definitions:
- **`pattern`** (`number[]`): An array of integers representing the unlock pattern sequence (e.g., `[1, 2, 3]`).
- **`device_points`** (`object`): A map of view keys (e.g., "front", "back") to arrays of coordinates (`{ x: number, y: number }`) representing damage locations.
- **`form`** (`object`):
    - `date` (`string`): ISO date string (YYYY-MM-DD).
    - `pin` (`string`): Device PIN code or password.
    - `total_amount` (`number`, optional): Estimated repair cost.
- **`checklist`** (`object`): Groups of checklist items. Each item has an `id` (string) and a `checked` (boolean) status.
    - Categories: `display`, `body`, `ports-1`, `ports`, `other`.
- **`comments`** (`string`, optional): Additional notes regarding the device condition.

### Response (Server-Sent Events)
This endpoint returns a `text/event-stream`. Each event contains a JSON payload in the `data` field.

#### Event Types:
- `started`: Generation process has begun.
- `data_loaded`: Repair order data has been retrieved from the database.
- `storage_prepared`: Old service form files have been cleaned up from storage.
- `pdf_generated`: The PDF document has been successfully generated.
- `uploaded`: The PDF has been uploaded to cloud storage.
- `completed`: The process is finished. The `result` field contains the `warranty_id`.
- `failed`: An error occurred during generation.

#### Success Example (`event: completed`):
```json
{
  "success": true,
  "data": {
    "state": "completed",
    "message": "Service form generated successfully",
    "result": {
      "warranty_id": "SF-A3B9K2",
      "message": "Service form generated successfully"
    }
  }
}
```

#### Failure Example (`event: failed`):
```json
{
  "success": false,
  "data": {
    "state": "failed",
    "message": "Repair order not found"
  },
  "statusCode": 404,
  "message": "Repair order not found",
  "error": "NotFoundException",
  "timestamp": "2026-05-12T10:00:00.000Z"
}
```

### Error States
| Status | Description |
| :--- | :--- |
| `400 Bad Request` | Validation error (e.g., missing required fields). |
| `401 Unauthorized` | Invalid or missing Bearer token. |
| `404 Not Found` | Repair order not found. |
| `500 Internal Error` | PDF generation or storage upload failed (sent as a `failed` event). |

---

## 2. Get Service Form Data
Retrieves the latest service form data and a **temporary presigned URL** to download the generated PDF.

### Endpoint
`GET /repair-orders/service-forms/:repair_order_id`

### URL Parameters
| Parameter | Type | Description |
| :--- | :--- | :--- |
| `repair_order_id` | `UUID` | The unique identifier of the Repair Order. |

### Response (`200 OK`)
If a service form exists:
```json
{
  "warranty_id": "SF-A3B9K2",
  "url": "https://storage.procare.uz/service-forms/.../SF-A3B9K2.pdf?X-Amz-Algorithm=...",
  "pattern": [1, 2, 4, 5],
  "device_points": {
    "front": [{ "x": 0.25, "y": 0.4 }]
  },
  "form": {
    "date": "2026-05-12",
    "pin": "1234",
    "total_amount": 450000
  },
  "checklist": {
    "display": [{ "id": "screen-crack", "checked": true }],
    "body": [],
    "ports-1": [],
    "ports": [],
    "other": []
  },
  "comments": "Minor scratch on the bottom left corner."
}
```

If **no** service form exists for this repair order:
```json
{}
```

#### Important Note on `url`:
The `url` field contains a presigned URL that **expires in 1 hour**. Do not hardcode or cache this URL long-term. Always fetch a fresh URL from this endpoint when the user needs to view/download the PDF.

---

## Data Synchronization (Checklists & Damage Points)

To ensure the generated PDF looks professional and accurate, the frontend must synchronize its data structures with the backend's PDF rendering engine.

### 1. Checklist Items (Index-based Mapping)
The PDF rendering engine uses a fixed set of titles for checkboxes. The `checklist` arrays you send in the `POST` request must follow the **exact order** below. The `id` field in your objects is for your internal use; the PDF engine renders labels based on the **index** of the item in the array.

| Category (`groupKey`) | Index | Label in PDF (Uzbek) | Description |
| :--- | :--- | :--- | :--- |
| **`display`** | 0 | Ekran (LCD/Display) | Display status |
| | 1 | Oyna/Sensor | Glass/Touch sensor |
| | 2 | Old kamera | Front camera |
| | 3 | Asosiy kamera | Main camera |
| **`body`** | 0 | Oldi tomon shisha | Front glass |
| | 1 | Orqa tomon shisha | Back glass |
| | 2 | Kamera oynasi | Camera glass |
| | 3 | Frame (Obodok) | Device frame/bezel |
| **`ports-1`** | 0 | Ekran | Settings -> Display check |
| | 1 | Batareyka | Settings -> Battery check |
| | 2 | MacSafe | MagSafe/Wireless check |
| | 3 | Kamera | Settings -> Camera check |
| | 4 | Korpus | Settings -> Body/Parts check |
| **`ports`** | 0 | Tugmalar | Physical buttons |
| | 1 | Face ID | Biometrics |
| | 2 | Touch ID | Biometrics |
| | 3 | Vibratsiya | Haptics |
| | 4 | Antenna | Network |
| | 5 | Wi-Fi | Connectivity |
| | 6 | Bluetooth | Connectivity |
| | 7 | Fonar | Flashlight |
| | 8 | SIM Karta | SIM tray/reader |
| | 9 | SD Karta | SD tray/reader |
| **`other`** | 0 | Kolonka | Speakers |
| | 1 | Mikrofon | Microphones |
| | 2 | Quvvat porti | Charging port |

### 2. Device Points (Damage Mapping)
The `device_points` object uses specific keys to map damage markers onto a composite image of the phone. You can use either the generic `viewN` keys or the more descriptive aliases.

| Key (or Alias) | Description |
| :--- | :--- |
| `front` (or `view1`) | Front view of the device |
| `back` (or `view2`) | Back view of the device |
| `view3` | Camera module / Detail view |
| `side` (or `view4`) | Left/Right side view |
| `view5` | Top/Bottom view |
| `view6` | Secondary side / Detail view |

**Coordinate System:**
- `x`: `0.0` (left) to `1.0` (right)
- `y`: `0.0` (top) to `1.0` (bottom)
- Coordinates are relative to the bounding box of the specific view, not the entire image.

---

## Integration Tips for Frontend

1. **Canvas Implementation:** When implementing the "Damage Mapping" UI, normalize your coordinates (0 to 1) before sending them in `device_points`. This ensures compatibility across different screen sizes.
2. **Form Persistence:** It is recommended to use the `GET` endpoint to pre-fill the form if the user returns to edit a previously created service form.
3. **PDF Viewing:** Since the `url` is a direct link to a PDF, you can use an `<iframe>`, `<embed>`, or a library like `pdf.js` to display it within your application.
4. **Warranty ID:** The `warranty_id` is automatically generated by the backend (format: `SF-XXXXXX`). It serves as the unique reference for the physical receipt given to the customer.

---

## Appendix: Warranty Agreement (SSE)
*Note: This is an advanced streaming endpoint for generating the final Warranty Agreement after repair completion.*

`GET /repair-orders/service-forms/:repair_order_id/warranty-agreement`
- **Type:** Server-Sent Events (SSE)
- **Events:** `started`, `data_loaded`, `pdf_generated`, `uploaded`, `completed`, `failed`.
- **Purpose:** Provides real-time progress updates for PDF generation, which can be a slow process. The final `completed` event contains the download URL.
