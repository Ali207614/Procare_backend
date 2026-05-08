# Professional Integration Plan: Google Sheets to Repair Orders

## 1. Executive Summary
This document outlines the architectural design and implementation plan for integrating Google Sheets as a lead source for the Repair Order system. The goal is to automatically capture leads from Google Sheets, create Repair Orders, and subsequently convert these leads into registered Users upon successful qualification by staff.

## 2. Architecture Overview

### Data Flow Diagram
```mermaid
graph LR
    A[External Services] -->|Update| B[Google Sheet]
    B -->|Trigger (onEdit)| C[Google Apps Script]
    C -->|POST Webhook| D[Backend API]
    D -->|Create| E[Repair Order (Lead)]
    E -->|Status Change| F[Worker/Admin]
    F -->|Move to 'Active'| G[Backend Service]
    G -->|Check Phone| H{User Exists?}
    H -->|No| I[Create User]
    H -->|Yes| J[Link User]
    I --> J
    J -->|Update| E
```

### Key Components
1.  **Google Sheets & Apps Script**: Acts as the data source and trigger mechanism.
2.  **Integrations Module (NestJS)**: A new dedicated module to handle external webhooks securely.
3.  **Repair Order Service**: Enhanced to support "Lead" creation and automated User conversion.

---

## 3. Google Sheets Integration Guide

### 3.1 Sheet Structure
Ensure your Google Sheet has the following header structure (columns can be in any order, but mapping is crucial):
*   **Column A**: `Name` (Customer Name)
*   **Column B**: `Phone Verified` (Data from external service)
*   **Column C**: `Messages` (Raw lead data/message)
*   **Column D**: `Sync Status` (Used by script to prevent loops)

### 3.2 Google Apps Script Code
Open your Google Sheet -> **Extensions** -> **Apps Script** and paste the following code:

```javascript
/*
 * Google Apps Script for sending Lead Data to Backend
 * Trigger: onEdit or onChange
 */

// CONFIGURATION
const API_URL = "https://your-backend-domain.com/api/v1/integrations/leads/webhook";
const AUTH_TOKEN = "YOUR_SECURE_TOKEN"; // Optional: For basic security
const SHEET_NAME = "Leads"; // Name of the tab to watch

function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  if (sheet.getName() !== SHEET_NAME) return;

  const range = e.range;
  const row = range.getRow();
  const col = range.getColumn();
  
  // Skip header row
  if (row <= 1) return;

  // OPTIONAL: Only trigger if specific column changes (e.g., Column 1 'Name' or Column 2 'Phone')
  // if (col < 1 || col > 3) return; 

  // Check if already synced to avoid loops
  const statusCell = sheet.getRange(row, 4); // Column D is Sync Status
  if (statusCell.getValue() === "Synced") return;

  // Fetch Row Data
  const name = sheet.getRange(row, 1).getValue(); // A
  const phone = sheet.getRange(row, 2).getValue(); // B
  const message = sheet.getRange(row, 3).getValue(); // C

  if (!name || !phone) return; // Ensure basic data exists

  const payload = {
    name: name,
    phone_number: phone,
    raw_message: message,
    source: "GoogleSheet"
  };

  try {
    const options = {
      'method' : 'post',
      'contentType': 'application/json',
      'payload' : JSON.stringify(payload),
      'muteHttpExceptions': true
    };
    
    // Send Webhook to Backend
    const response = UrlFetchApp.fetch(API_URL, options);
    
    if (response.getResponseCode() === 200 || response.getResponseCode() === 201) {
      statusCell.setValue("Synced");
      Logger.log("Successfully synced row " + row);
    } else {
      statusCell.setValue("Error: " + response.getResponseCode());
      Logger.log("Error syncing row " + row + ": " + response.getContentText());
    }
  } catch (error) {
    statusCell.setValue("Failed");
    Logger.log("Exception: " + error.toString());
  }
}
```

### 3.3 Deployment
1.  Save the script.
2.  Set up a Trigger: Click on the **Triggers** icon (alarm clock) -> **Add Trigger**.
    *   Function: `onEdit`
    *   Event Source: `From spreadsheet`
    *   Event Type: `On edit` (or `On change` if rows are added by external tools automatically, not manual typing).
3.  **Crucial:** If external tools insert rows, `onEdit` might not fire. Use `onChange` and create a scheduled trigger (e.g., every minute) to scan for rows without "Synced" status if `onChange` is unreliable for bulk inserts.

---

## 4. Backend Implementation Plan

### Phase 1: Prerequisites & Configuration
1.  **System Admin User**: Identify or create a specific Admin user (e.g., "System Bot") to use as the `created_by` for these automated Repair Orders.
    *   Action: Add `SYSTEM_ADMIN_ID` to `.env`.
2.  **Default Branch**: Identify the Branch ID where leads should land.
    *   Action: Add `DEFAULT_LEAD_BRANCH_ID` to `.env`.
3.  **Default Phone Category**: Ensure a generic category exists (e.g., "General Inquiry" or "Unknown Device").
    *   Action: Create migration or seed if missing.
4.  **Lead Status**: Ensure a valid status exists in `repair_order_statuses` for raw leads (e.g., "New Lead").

### Phase 2: Integrations Module (Create Lead)
**Module:** `src/integrations/integrations.module.ts`

**Controller:** `IntegrationsController`
*   **Endpoint**: `POST /integrations/leads`
*   **DTO**: `CreateLeadDto` (`name`, `phone_number`, `raw_message`)

**Service Logic (`IntegrationsService` or `RepairOrderCreateHelperService`):**
1.  **Validate**: Ensure phone number is valid format.
2.  **Context**: Load System Admin and Default Branch/Category/Status.
3.  **Create Repair Order**:
    *   `user_id`: `NULL` (Store user info in `repair_orders.name` and `repair_orders.phone_number` only).
    *   `status_id`: "New Lead".
    *   `problem_description`: Store `raw_message`.
    *   `delivery/pickup`: Default to "Self".

### Phase 3: Automated User Conversion (Move Logic)
**Location:** `src/repair-orders/repair-orders.service.ts` -> `move()`

**Algorithm**:
When a Repair Order is moved *FROM* "New Lead" *TO* any "Active/Working" status (e.g., "Diagnosis", "In Progress"):
1.  **Check Linking**: Does `repair_order.user_id` already exist?
    *   If **Yes**: Continue (User already linked).
    *   If **No**: Proceed to conversion.
2.  **User Lookup**:
    *   Query `users` table by `repair_order.phone_number`.
    *   Normalize phone number (remove spaces, symbols) for search.
3.  **User Creation/Linking**:
    *   **Scenario A: User Found**:
        *   Update `repair_order.user_id` = `foundUser.id`.
    *   **Scenario B: User Not Found**:
        *   Extract First/Last Name from `repair_order.name`.
        *   Create new `User` entity (using `UsersService.create` logic).
        *   Update `repair_order.user_id` = `newUser.id`.
4.  **Completion**: Proceed with the status status change.

### Phase 4: Implementation Steps

#### Step 1: Create Module Structure
```bash
nest g module integrations
nest g controller integrations
nest g service integrations
```

#### Step 2: Implement Controller & Service
Create the `createLead` method handling the logic defined in Phase 2.

#### Step 3: Modify RepairOrdersService
Update the `move` method to inject `UsersService` and implement the conversion logic defined in Phase 3.

---

## 5. Security Considerations
*   **Webhook Secret**: Secure the `/integrations/` endpoint with a custom guard checking a header (e.g., `X-Integration-Secret`) matching an ENV variable. This prevents public spam.
*   **Validation**: Strictly validate phone numbers to avoid database contamination.
*   **Rate Limiting**: Apply rate limiting to the webhook endpoint.

## 6. Testing Strategy
1.  **Unit Test**: Mock `RepairOrdersService` and verify lead creation logic.
2.  **Integration Test**:
    *   Send POST to webhook with raw data.
    *   Verify `RepairOrder` is created with `NULL` user_id.
    *   Call `move` endpoint to change status.
    *   Verify `User` is created in `users` table and linked to `RepairOrder`.
