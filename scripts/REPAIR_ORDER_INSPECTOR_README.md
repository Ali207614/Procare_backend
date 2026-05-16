# Repair Order Inspector Script

This script fetches and displays detailed information about a specific repair order, including its full data and complete change history/timeline.

## Setup

1. **Create a `.env` file** in the project root with the following variables:
   ```
   PRODUCTION_SERVER_URL=http://localhost:5001/api/v1
   TEST_PHONE_NUMBER=+998901234567
   TEST_PASSWORD=your_password_here
   ```
   
   Alternatively, copy `.env.example` and update it:
   ```bash
   cp .env.example .env
   ```

2. **Ensure the required packages are installed** - the script uses built-in `dotenv` and `fetch` APIs.

## Usage

Run the script with a repair order UUID:

```bash
# Using npm script
npm run get:repair-order <repair-order-uuid>

# Or using ts-node directly
ts-node -r tsconfig-paths/register scripts/get-repair-order.ts <repair-order-uuid>

# Example
npm run get:repair-order 550e8400-e29b-41d4-a716-446655440000
```

## Output

The script displays:

### 1. **Repair Order Information**
- ID, Status, Priority, Source
- Branch ID, User ID, Phone Category
- Creation and update timestamps
- Customer name and device serial (if available)

### 2. **Change Timeline**
- Chronological list of all events that affected the repair order
- For each event:
  - **Time**: When the event occurred
  - **Action**: Type of event (e.g., `repair_orders.update`)
  - **Event ID**: Unique identifier
  - **Actors**: Who made the change (admin/user)
  - **Changes**: Field modifications with old and new values
  - **Related Entities**: Other entities involved

## Example Output

```
================================================================================
REPAIR ORDER INFORMATION
================================================================================
ID: 550e8400-e29b-41d4-a716-446655440000
Status: 50000000-0000-0000-0001-001000000000
Priority: Medium
Source: Sug'urta
Branch ID: 00000000-0000-0000-0000-000000000000
User ID: 550e8400-e29b-41d4-a716-446655440001
Phone Category: 550e8400-e29b-41d4-a716-446655440002
Created: 5/14/2026, 10:30:00 AM
Updated: 5/14/2026, 2:45:30 PM

================================================================================
REPAIR ORDER TIMELINE
================================================================================
Total Events: 3

📅 Event #1
   Time: 5/14/2026, 10:30:00 AM
   Action: repair_orders.create
   Event ID: 650e8400-e29b-41d4-a716-446655440001
   Actors:
     - John Doe (admin)

📅 Event #2
   Time: 5/14/2026, 1:15:30 PM
   Action: repair_orders.update
   Event ID: 750e8400-e29b-41d4-a716-446655440001
   Actors:
     - John Doe (admin)
   Changes:
     - status_id
       From: New Order
       To:   In Progress

📅 Event #3
   Time: 5/14/2026, 2:45:30 PM
   Action: repair_orders.update
   Event ID: 850e8400-e29b-41d4-a716-446655440001
   Actors:
     - Jane Smith (admin)
   Changes:
     - priority
       From: Low
       To:   Medium
```

## Error Handling

The script will display helpful error messages for:
- Missing environment variables
- Invalid UUID format
- Authentication failures
- Network errors
- API response errors

## Requirements

- Node.js with TypeScript support
- `dotenv` package (already in project)
- Network access to the specified `PRODUCTION_SERVER_URL`
- Valid admin credentials (phone number and password)
