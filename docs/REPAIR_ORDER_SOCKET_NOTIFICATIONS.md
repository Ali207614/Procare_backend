# Repair Order Socket Notifications

## Purpose

The repair order notification socket gives CRM admins real-time updates when repair orders are created, updated, moved between statuses, assigned, or affected by telephony workflows. The frontend should use it to keep order lists, Kanban columns, counters, badges, and toast notifications fresh without forcing a full page reload.

This socket is implemented with **Socket.IO**, not a raw WebSocket endpoint.

## Production Connection Summary

| Item | Value |
| :--- | :--- |
| Socket library | `socket.io-client` |
| Production socket origin | `https://crm-api.procare.uz` |
| Socket.IO path | `/socket.io/` |
| Namespace | `/` |
| Required query parameter | `adminId` |
| Server event to listen for | `notification` |
| REST API base URL | `https://crm-api.procare.uz/api/v1` |

Important: do **not** connect sockets to `/api/v1`.

Use:

```ts
io("https://crm-api.procare.uz", { query: { adminId } });
```

Do not use:

```ts
io("https://crm-api.procare.uz/api/v1", { query: { adminId } });
```

`/api/v1` is the REST prefix. Socket.IO negotiates through `/socket.io/` on the API origin.

## Backend Behavior

The backend gateway is `NotificationGateway` in `src/notification/notification.gateway.ts`.

On connection, the server:

1. Reads `adminId` from `client.handshake.query.adminId`.
2. Maps that admin id to the connected `socket.id`.
3. Loads the admin's assigned branches.
4. Joins the socket to each branch room using this format:

```text
branch:{branchId}
```

Notifications are then delivered in two ways:

| Delivery mode | Backend method | Frontend impact |
| :--- | :--- | :--- |
| Branch broadcast | `broadcastToBranch(branchId, payload)` | Every connected admin in that branch room receives the event. |
| Direct admin broadcast | `broadcastToAdmins(adminIds, payload)` | Only selected connected admins receive the event. |

The frontend does not manually join rooms. Room assignment happens on the server based on the connected admin.

## Installing the Client

Use the Socket.IO client, preferably the same major version as the backend.

```bash
pnpm add socket.io-client@4
```

or:

```bash
npm install socket.io-client@4
```

The backend currently uses Socket.IO `4.x`.

## Environment Configuration

Many frontends store the REST base URL with `/api/v1`, for example:

```env
VITE_API_BASE_URL=https://crm-api.procare.uz/api/v1
```

The socket URL must be the origin only:

```env
VITE_SOCKET_URL=https://crm-api.procare.uz
```

If you only have the REST base URL, derive the socket origin safely:

```ts
export function getSocketOrigin(apiBaseUrl: string): string {
  return new URL(apiBaseUrl).origin;
}

const socketOrigin = getSocketOrigin("https://crm-api.procare.uz/api/v1");
// "https://crm-api.procare.uz"
```

## TypeScript Event Contract

The socket emits a single frontend event:

```text
notification
```

Recommended frontend types:

```ts
export type NotificationAction =
  | "order_created"
  | "order_updated"
  | "status_changed"
  | "assigned_to_order"
  | "take"
  | "restore"
  | "customer_no_answer_recorded"
  | "customer_no_answer_missed"
  | "customer_no_answer_invalidated";

export interface RepairNotificationMeta {
  order_id?: string;
  number_id?: string;
  sort?: number;
  phone_category_name?: string | null;
  user_full_name?: string | null;
  user_phone_number?: string | null;
  pickup_method?: string;
  delivery_method?: string;
  priority?: string;
  source?: string;
  assigned_admins?: string | null;
  action?: NotificationAction | string;
  from_status_id?: string;
  to_status_id?: string;
  branch_id?: string;
  assigned_by?: string;
  open_menu?: boolean;
  is_trigger?: boolean;
  [key: string]: unknown;
}

export interface RepairOrderSocketNotification {
  title: string;
  message: string;
  meta: RepairNotificationMeta | null;
}
```

Why most fields are optional on the frontend:

- Some direct assignment notifications only include a smaller `meta` object.
- Some older or system-triggered notifications may not include all rich repair order fields.
- `meta` can be `null` according to the shared backend type.

Always parse defensively.

## Basic Frontend Usage

```ts
import { io } from "socket.io-client";

const socket = io("https://crm-api.procare.uz", {
  query: {
    adminId: "00000000-0000-4000-8000-000000000000",
  },
});

socket.on("connect", () => {
  console.log("Notifications socket connected:", socket.id);
});

socket.on("notification", (payload) => {
  console.log("Notification:", payload);
});

socket.on("disconnect", (reason) => {
  console.log("Notifications socket disconnected:", reason);
});

socket.on("connect_error", (error) => {
  console.error("Notifications socket connection failed:", error.message);
});
```

## Recommended Socket Client Module

Create one socket instance per logged-in admin session. Avoid creating a new socket on every render.

```ts
import { io, Socket } from "socket.io-client";

import type { RepairOrderSocketNotification } from "./notification-types";

type ServerToClientEvents = {
  notification: (payload: RepairOrderSocketNotification) => void;
};

type ClientToServerEvents = Record<string, never>;

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
let activeAdminId: string | null = null;

export function connectNotificationsSocket(params: {
  socketUrl: string;
  adminId: string;
  onNotification: (payload: RepairOrderSocketNotification) => void;
  onConnected?: (socketId: string | undefined) => void;
  onDisconnected?: (reason: string) => void;
  onError?: (message: string) => void;
}) {
  if (socket && activeAdminId === params.adminId) {
    return socket;
  }

  disconnectNotificationsSocket();
  activeAdminId = params.adminId;

  socket = io(params.socketUrl, {
    query: {
      adminId: params.adminId,
    },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
    timeout: 10_000,
  });

  socket.on("connect", () => {
    params.onConnected?.(socket?.id);
  });

  socket.on("notification", params.onNotification);

  socket.on("disconnect", (reason) => {
    params.onDisconnected?.(reason);
  });

  socket.on("connect_error", (error) => {
    params.onError?.(error.message);
  });

  return socket;
}

export function disconnectNotificationsSocket() {
  if (!socket) return;

  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
  activeAdminId = null;
}
```

## React Hook Example

```tsx
import { useEffect } from "react";

import {
  connectNotificationsSocket,
  disconnectNotificationsSocket,
} from "./notifications-socket";
import type { RepairOrderSocketNotification } from "./notification-types";

interface UseRepairOrderNotificationsParams {
  adminId?: string;
  socketUrl: string;
  onNotification: (payload: RepairOrderSocketNotification) => void;
}

export function useRepairOrderNotifications({
  adminId,
  socketUrl,
  onNotification,
}: UseRepairOrderNotificationsParams) {
  useEffect(() => {
    if (!adminId) return;

    connectNotificationsSocket({
      socketUrl,
      adminId,
      onNotification,
      onConnected: (socketId) => {
        console.info("Notifications connected", socketId);
      },
      onDisconnected: (reason) => {
        console.info("Notifications disconnected", reason);
      },
      onError: (message) => {
        console.error("Notifications socket error", message);
      },
    });

    return () => {
      disconnectNotificationsSocket();
    };
  }, [adminId, socketUrl, onNotification]);
}
```

Use the hook once near the authenticated CRM shell or layout, not inside every repair order row/card.

In React, keep `onNotification` stable with `useCallback` or route socket events into a central store. If `onNotification` is recreated every render, the hook will disconnect and reconnect more often than necessary.

## Handling Notifications in the UI

The backend sends enough metadata for the frontend to update visible state, but the frontend should still use the REST API as the source of truth when it needs complete order data.

Recommended handling by action:

| `meta.action` | Recommended frontend behavior |
| :--- | :--- |
| `order_created` | Show a toast, increment branch/order counters, and insert or refetch the first page of the affected list. |
| `order_updated` | Patch visible order fields when present, or refetch the affected order/list if the visible card is stale. |
| `status_changed` | Move the order between status columns using `from_status_id`, `to_status_id`, and `sort`; refetch columns if ordering is uncertain. |
| `assigned_to_order` | Show an assignment toast and refresh the assigned/admin workload views. |
| `take` | Refresh the affected order card and assignment indicators. |
| `restore` | Re-add the order to the active list or refetch the current list. |
| `customer_no_answer_recorded` | Update call/no-answer indicators and show a low-priority toast. |
| `customer_no_answer_missed` | Move the order to the missed/no-answer status if that status is visible. |
| `customer_no_answer_invalidated` | Move the order to the invalid status and refresh reject-cause/status data if visible. |

Use `open_menu: true` as a UI hint. It is used for telephony flows where the frontend should open the repair order details panel/modal for the receiving admin.

Use `is_trigger: true` as a UI hint for scheduled system notifications, such as agreed-time reminders.

## Example Event Payloads

### New repair order

```json
{
  "title": "Yangi buyurtma",
  "message": "Filialda yangi buyurtma yaratildi: #7520",
  "meta": {
    "order_id": "a75209d7-45eb-40bf-8e3f-07b5c0ea7d92",
    "number_id": "7520",
    "sort": 1,
    "phone_category_name": "iPhone 14 Pro",
    "user_full_name": "Ali Valiyev",
    "user_phone_number": "+998901234567",
    "pickup_method": "Self",
    "delivery_method": "Self",
    "priority": "Medium",
    "source": "CRM",
    "assigned_admins": "Habibulloh Jo'rayev",
    "action": "order_created",
    "open_menu": false
  }
}
```

### Status change

```json
{
  "title": "Buyurtma holati o'zgardi",
  "message": "Buyurtma #7520 yangi statusga o'tdi",
  "meta": {
    "order_id": "a75209d7-45eb-40bf-8e3f-07b5c0ea7d92",
    "number_id": "7520",
    "sort": 1,
    "action": "status_changed",
    "from_status_id": "11111111-1111-4111-8111-111111111111",
    "to_status_id": "22222222-2222-4222-8222-222222222222"
  }
}
```

### Incoming call that should open the order

```json
{
  "title": "Kiruvchi qo'ng'iroq",
  "message": "Buyurtma #7520 bo'yicha kiruvchi qo'ng'iroq mavjud",
  "meta": {
    "order_id": "a75209d7-45eb-40bf-8e3f-07b5c0ea7d92",
    "number_id": "7520",
    "action": "order_updated",
    "open_menu": true
  }
}
```

### Agreed-time trigger

```json
{
  "title": "Kelishilgan vaqt yetib keldi",
  "message": "Buyurtma #7520 uchun kelishilgan vaqt yetib keldi",
  "meta": {
    "order_id": "a75209d7-45eb-40bf-8e3f-07b5c0ea7d92",
    "number_id": "7520",
    "sort": 1,
    "action": "order_updated",
    "is_trigger": true
  }
}
```

## State Synchronization Strategy

Prefer this order of operations:

1. Use the socket payload for immediate UX: toast, sound, badges, and optimistic card movement.
2. If the affected order is visible, patch simple fields from `meta`.
3. If a status, branch, assignee, or sort position changed, refetch the affected board column/list.
4. If the notification references an order not loaded in the current view, avoid fetching immediately unless the current view should show it.
5. Periodically or on window focus, reconcile with REST data to recover from missed socket events.

Socket events are real-time hints, not a complete replacement for REST reads.

## Notification History and Missed Events

Socket delivery only reaches currently connected clients. Persisted notification history is available through the REST API.

All routes below are under the REST prefix:

```text
https://crm-api.procare.uz/api/v1
```

| Method | Endpoint | Purpose |
| :--- | :--- | :--- |
| `GET` | `/notifications?offset=0&limit=20` | Fetch current admin notification history. |
| `GET` | `/notifications?is_read=false&offset=0&limit=20` | Fetch unread notifications. |
| `PATCH` | `/notifications/{notificationId}/read` | Mark one notification as read. |
| `PATCH` | `/notifications/read-all` | Mark all notifications as read. |

These endpoints require the regular admin JWT bearer token. The socket currently identifies the admin by `adminId` query parameter; REST history identifies the admin from the JWT.

## Connection Lifecycle Requirements

Frontend should connect only when:

- The admin is authenticated.
- The admin id is available.
- The app is inside an authenticated CRM session.

Frontend should disconnect when:

- The admin logs out.
- The app clears the auth/session state.
- The user switches to a different admin account.

When the admin id changes, close the old socket and create a new one. Do not keep a socket connected with a stale `adminId`.

## Reconnection Guidance

Socket.IO reconnects automatically by default. Keep reconnection enabled.

Recommended user-facing behavior:

- Do not show a blocking error for short disconnects.
- Show a small passive offline/reconnecting indicator if disconnected for more than a few seconds.
- On reconnect, refetch notification history and the currently visible repair order list/board.
- Avoid playing notification sounds for events loaded from REST reconciliation.

## Error Handling

Handle these client events:

```ts
socket.on("connect", () => {});
socket.on("disconnect", (reason) => {});
socket.on("connect_error", (error) => {});

socket.io.on("reconnect_attempt", (attempt) => {});
socket.io.on("reconnect", (attempt) => {});
```

Typical causes:

| Error/symptom | Likely cause | Fix |
| :--- | :--- | :--- |
| `Invalid namespace` | Client connected to `https://crm-api.procare.uz/api/v1` | Connect to `https://crm-api.procare.uz`. |
| `Transport unknown` | Missing or empty Socket.IO `transport` query in manual tests | Use a real `socket.io-client`, or include `transport=polling` in low-level checks. |
| `Unexpected server response: 400` with `transport=websocket` | Production proxy/server is rejecting direct WebSocket upgrade | Allow polling, or fix Nginx/WebSocket upgrade forwarding. |
| Connected but no events | Admin has no assigned branches, wrong admin id, or no relevant events occurred | Verify admin branch assignment and generate a relevant repair order event. |

## Testing With Postman

Postman's Socket.IO tab uses WebSocket transport. Current production behavior has been observed to accept Socket.IO polling but reject direct WebSocket-only connections.

For a low-level reachability check in Postman, create a normal `GET` request:

```text
https://crm-api.procare.uz/socket.io/?EIO=4&transport=polling&adminId=00000000-0000-4000-8000-000000000000
```

Expected response starts with:

```text
0{"sid":
```

That confirms the Socket.IO server is reachable.

If Postman's Socket.IO request fails with a `400` WebSocket handshake, but the polling check works, the socket server is alive and the problem is WebSocket upgrade support in production routing/proxy configuration.

## Browser DevTools Testing

From the browser console on a page that has `socket.io-client` bundled:

```ts
const socket = io("https://crm-api.procare.uz", {
  query: {
    adminId: "00000000-0000-4000-8000-000000000000",
  },
});

socket.on("connect", () => console.log("connected", socket.id));
socket.on("notification", console.log);
socket.on("connect_error", (error) => console.error(error.message));
```

If `io` is not available globally, test from the application code or a small local script using `socket.io-client`.

## Production Proxy Notes

For full WebSocket support through Nginx, the `/socket.io/` location must forward upgrade headers.

Example:

```nginx
location /socket.io/ {
    proxy_pass http://127.0.0.1:5001/socket.io/;

    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    proxy_read_timeout 60s;
    proxy_send_timeout 60s;
}
```

The frontend does not need to force WebSocket transport. Let Socket.IO negotiate transports unless there is a specific production requirement to disable polling.

Recommended:

```ts
io("https://crm-api.procare.uz", {
  query: { adminId },
});
```

Avoid unless WebSocket upgrade is known to work:

```ts
io("https://crm-api.procare.uz", {
  query: { adminId },
  transports: ["websocket"],
});
```

## Security Notes

The current socket handshake uses `adminId` as an identifier. It is not the same as REST JWT authorization.

Frontend requirements:

- Only connect after a valid admin login.
- Use the authenticated admin's real id from the current session.
- Do not let users manually override `adminId`.
- Disconnect immediately on logout.
- Treat socket payloads as untrusted input and validate before updating critical UI state.

Backend hardening to consider in the future:

- Pass the admin JWT in `auth` during the Socket.IO handshake.
- Validate the token in the gateway.
- Derive `adminId` from the verified token instead of trusting a query parameter.

Example future client shape:

```ts
io("https://crm-api.procare.uz", {
  auth: {
    token: accessToken,
  },
});
```

This is not the current backend contract, but it is the recommended direction for stronger socket authentication.

## Frontend Checklist

- Connect to `https://crm-api.procare.uz`, not `/api/v1`.
- Send `adminId` in the Socket.IO handshake query.
- Listen for the `notification` event.
- Keep exactly one active notification socket per authenticated admin session.
- Disconnect on logout or account switch.
- Use `meta.action` to decide the UI update.
- Use `open_menu` and `is_trigger` as UI hints.
- Refetch visible lists/columns after reconnect and after complex move/update events.
- Use REST `/api/v1/notifications` endpoints for persisted history and unread state.
- Do not force `transports: ["websocket"]` until production WebSocket upgrade support is confirmed.
