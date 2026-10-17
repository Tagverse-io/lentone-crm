# Expo App API Contract

Base URL (production): `https://crm.lentone.in`
Fallback: `https://lentone-crm.vercel.app`
Local: `http://localhost:3000`

All `/api/app/*` routes require:

```
Authorization: Bearer <APP_API_KEY>
```

`APP_API_KEY` is a server-only env var (Vercel project settings, never shipped in the app binary — inject at build time via EAS secrets).

## Polling model (no WebSockets, no SSE)

- The Expo app polls **`GET /api/app/tasks?workerId=` every 30 seconds** for its open tasks and deliveries.
- The web UI polls Firebase directly (SWR: 15s on hot lists, 60s elsewhere, paused when the tab is hidden).
- All realtime plumbing lives in `crm-frontend/src/lib/realtime.ts` so the transport can be swapped later.

## POST /api/app/events

Expo app → ERP webhook. Body (JSON, validated with zod):

```json
{
  "workerId": "demo-worker-1",
  "workerName": "Arun Kumar",
  "phone": "+919800011101",
  "event": "login",
  "timestamp": "2026-10-16T09:02:00.000Z"
}
```

`event` is one of `login | logout | location | task_update | delivery_update`.

### Login / logout (attendance)

```json
{ "workerId": "w1", "workerName": "Arun Kumar", "event": "login", "timestamp": "2026-10-16T09:02:00.000Z" }
{ "workerId": "w1", "event": "logout", "timestamp": "2026-10-16T18:05:00.000Z" }
```

- `login` upserts `/workers/{workerId}` (name/phone) and writes `/attendance/{workerId}/{YYYY-MM-DD}` with `loginAt`.
- `logout` sets `logoutAt` and computes `hoursWorked`.

### Background location (Google Maps URL only)

```json
{
  "workerId": "w1",
  "event": "location",
  "mapsUrl": "https://www.google.com/maps?q=9.9816,76.2999",
  "timestamp": "2026-10-16T12:30:00.000Z"
}
```

- Accepts `maps.google.com`, `google.com/maps` and `maps.app.goo.gl` links (validated server-side).
- Updates `/locations/{workerId}/latest` and pushes `/locations/{workerId}/history/{pushId}`.
- The web UI renders `mapsUrl` as a clickable **"View location"** link (`target="_blank"`, Google Maps). No embedded map, no map SDK.

### Task status change

The Expo app sends **app-friendly statuses**, which the server maps onto the CRM model:

| App sends | CRM effect |
| --- | --- |
| `accepted` | `acceptedAt` recorded; denial cleared; task stays `Assigned` |
| `denied` (+ `denyReason`) | `denyReason` + `deniedAt` recorded; task stays `Assigned` (reason is required) |
| `in_progress` | task → `In Progress`, `startedAt` recorded |
| `completed` | task → `Done` |

```json
{ "workerId": "w1", "event": "task_update", "taskId": "task-123", "status": "accepted", "timestamp": "2026-10-16T13:00:00.000Z" }
{ "workerId": "w1", "event": "task_update", "taskId": "task-123", "status": "denied", "denyReason": "Too far", "timestamp": "2026-10-16T13:00:00.000Z" }
```

- Server-canonical forms (`Assigned | In Progress | Done`) also accepted; anything else → `400`.
- The task row therefore carries derived worker state: `acceptedAt`, `deniedAt`, `denyReason`, `startedAt`.
- Writes a `/history/tasks/{taskId}` entry per action.

### Delivery update + proof photo

```json
{
  "workerId": "w1",
  "event": "delivery_update",
  "deliveryId": "delivery-123",
  "status": "Delivered",
  "mapsUrl": "https://www.google.com/maps?q=9.9816,76.2999",
  "proofBase64": "<data:image/jpeg;base64,...>",
  "timestamp": "2026-10-16T14:00:00.000Z"
}
```

- `status` is one of `Pending | Out for Delivery | Delivered`.
- The app MUST compress the photo to **at most 800px wide, JPEG quality 0.5** (≈100–200 KB) before base64-encoding.
- The webhook **rejects anything over 500 KB** (`413`).
- The base64 is stored **only** at `/deliveryProofs/{deliveryId}` (`{ proofBase64, updatedAt }`) — never under a listed path. The web UI loads it only when the thumbnail is clicked.
- On `Delivered`, the webhook also records a history entry and cascades: linked task → `Done`, linked order → `Delivered` (each with its own history entry) — the same cascade the web “Mark delivered” button runs.

## GET /api/app/worker?phone={number}

Used by the Expo **login screen**: verifies the number belongs to a registered field worker and returns the CRM name + canonical `workerId`.

- Phone matching is digit-normalized (last 10 digits), so `+91 98765 43210` matches `9876543210`.
- `404` → no worker has that number. The app shows *"This number is not registered in the CRM."*
- The app uses the returned `workerId` for all subsequent `/tasks?workerId=` polling and `/events` payloads, and displays the returned `name` — the login screen no longer asks for a name.

```json
{ "workerId": "w1", "name": "Arun Kumar", "phone": "+919800011101", "active": true }
```

## GET /api/app/tasks?workerId={id}

Returns the worker's open tasks and deliveries (poll every 30s):

```json
{
  "tasks": [{ "id": "...", "clientName": "...", "type": "Visit", "scheduledAt": "2026-10-16T10:00:00.000Z", "mapsUrl": "https://…", "status": "Assigned", "acceptedAt": "…", "deniedAt": "…", "denyReason": "…" }],
  "deliveries": [{ "id": "...", "clientName": "...", "mapsUrl": "https://…", "status": "Out for Delivery" }]
}
```

Tasks created by **Assign Work** carry `scheduledAt`, `mapsUrl`, and links (`orderId`, `deliveryId`, `invoiceId`); deliveries carry `mapsUrl` for the drop location. The app derives the worker's view from the raw status: `Denied` from `deniedAt`, `Accepted` from `acceptedAt`, otherwise the CRM status directly.

## Expo app checklist

- Background location sends `location` events with the Google Maps URL; login/logout events on app open/close.
- Task list reads `GET /api/app/tasks?workerId=` every 30 seconds.
- Proof photo screen: compress → base64 → `delivery_update` event (photo is optional — a Delivered event without `proofBase64` is valid).
- "Open in Google Maps" button uses `Linking.openURL(mapsUrl)` only. No map SDK.
