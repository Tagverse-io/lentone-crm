# Expo App API Contract

Base URL (production): `https://<your-vercel-app>.vercel.app`
Local: `http://localhost:3000`

All `/api/app/*` routes require:

```
Authorization: Bearer <APP_API_KEY>
```

`APP_API_KEY` is a server-only env var (Vercel project settings, never shipped in the app binary — inject at build time via EAS secrets).

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

- Updates `/locations/{workerId}/latest` and pushes `/locations/{workerId}/history/{pushId}`.
- The web UI renders `mapsUrl` as a clickable **"View location"** link (`target="_blank"`, Google Maps). No embedded map, no map SDK.

### Task status change

```json
{ "workerId": "w1", "event": "task_update", "taskId": "task-123", "status": "Done", "timestamp": "2026-10-16T13:00:00.000Z" }
```

`status` is one of `Assigned | In Progress | Done`.

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
- On `Delivered` with a photo, the delivery also records `proofAt`.

## GET /api/app/tasks?workerId={id}

Returns the worker's open tasks and deliveries:

```json
{
  "tasks": [{ "id": "...", "clientName": "...", "type": "visit", "dueDate": "2026-10-16", "status": "Assigned" }],
  "deliveries": [{ "id": "...", "clientName": "...", "status": "Out for Delivery" }]
}
```

Used by the app task list and by the web SSE fallback poller (every 30s).

## GET /api/app/stream?workerId={id}

Server-Sent Events stream of changes for that worker. Events:

```
event: message
data: {"type":"tasks","at":"2026-10-16T14:00:00.000Z"}
```

The client auto-reconnects (native `EventSource` retry) and falls back to polling `GET /api/app/tasks` every 30s. See `lib/realtime.ts` (`subscribeWorkerStream`).

## Expo app checklist

- Background location sends `location` events with the Google Maps URL; login/logout events on app open/close.
- Task list reads `GET /api/app/tasks?workerId=`; refresh on each SSE message; 30s poll fallback.
- Proof photo screen: compress → base64 → `delivery_update` event.
- "Open in Google Maps" button uses `Linking.openURL(mapsUrl)` only. No map SDK.
