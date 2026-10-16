# Lentone CRM — field-force web ERP (Next.js + Firebase)

Single Next.js App Router project in `crm-frontend` (shadcn/ui, white theme, sidebar layout).
Firebase is the only backend: Realtime Database for data, Firebase Auth for web login.
No other database.

**Modules:** Dashboard · Clients · Lead Management · Field Force · Inventory · Orders · Delivery · Revenue (Quotations, Invoices, Payments, Finance) · Settings

**Polling-only realtime** (Vercel serverless has no persistent WebSockets; no `onValue` listeners, no SSE, no WebSocket code in the frontend):
- Expo app → ERP: HTTPS webhook `POST /api/app/events` (Bearer `APP_API_KEY`, writes via firebase-admin).
- ERP web UI: SWR polling of Firebase — every 15s on hot lists (Dashboard, Field Force, Delivery, Tasks), every 60s elsewhere; pauses when the tab is hidden; every view has a manual refresh button.
- Expo app → ERP reads: `GET /api/app/tasks?workerId=` polled every 30s.
- Transport isolated in `crm-frontend/src/lib/realtime.ts` (swappable for Ably/Pusher later).

## Setup

```bash
cd crm-frontend
cp ../.env.example .env.local   # then fill in values (never commit .env.local)
npm install
npm run dev                      # http://localhost:3000
```

### Environment variables (also add these in Vercel project settings)

| Variable | Where |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | client + Vercel |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | client + Vercel |
| `NEXT_PUBLIC_FIREBASE_DATABASE_URL` | client + Vercel |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | client + Vercel |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | client + Vercel |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | client + Vercel |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | client + Vercel |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | client + Vercel |
| `FIREBASE_ADMIN_PROJECT_ID` | server only (Vercel) |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | server only (Vercel) |
| `FIREBASE_ADMIN_PRIVATE_KEY` | server only (Vercel, keep `\n` escaped) |
| `APP_API_KEY` | server only (Vercel) + Expo app (Bearer token) |

All variables are read from env only (validated with zod in `lib/env.ts` — missing vars throw naming the exact variable). No Firebase value, key or URL appears in source code.

### Firebase

1. Console → Authentication → enable **Google** and **Email/Password**; add authorized domains (localhost + Vercel domain).
2. Project settings → Service accounts → generate private key → fill `FIREBASE_ADMIN_CLIENT_EMAIL` / `FIREBASE_ADMIN_PRIVATE_KEY`.
3. Deploy rules: `firebase deploy --only database` (uses `database.rules.json` — authenticated users only; webhook writes via admin SDK).

### Seed demo data (≥25 records per module)

```bash
cd crm-frontend
npm run seed       # clients, leads, workers, tasks, products, orders, quotations, invoices, payments, deliveries, …
npm run selftest   # offline logic tests (totals, invoice status, stock validation, maps URLs) — no Firebase needed
```

### Migrate legacy data (safe to re-run)

```bash
cd crm-frontend
npm run migrate    # /orgs/* + /field_agents → flat paths (flagged legacy), backfills search keys, fixes counters
```

Migrated rows carry `legacy: true` and appear in the collapsed **Previous records** sections of detail/preview panels (toggle **Previous on** in lists to include them inline).

### The main flow (Assign Work)

1. Create a client with a Google Maps link (Clients → Add client; `maps.google.com`, `google.com/maps` or `maps.app.goo.gl` only).
2. Field Force → **Assign Work**: pick worker + client (map link prefills; required when the client has none; optional “Save this link to the client”), task type, date/time, inventory lines.
3. Save runs **one atomic multi-path update**: task + order + delivery (Pending) + invoice (Unpaid), stock deduction (blocked with a clear error when short), and one history entry per record in `/history/{entity}/{id}`.
4. Verify on Orders / Delivery / Invoices / Inventory (movement history) and the record History timelines.
5. Marking a delivery **Delivered** completes the linked task and order automatically (same cascade runs for Expo `delivery_update` webhooks).

### Deploy (Vercel)

1. New Vercel project, Root Directory `crm-frontend`.
2. Add all env vars above (Production + Preview).
3. Deploy.

### Expo app contract

See `docs/app-api.md` for endpoints + example requests (login/logout, background `location` with Google Maps URL, task list polling every 30s, proof-photo upload ≤500 KB, `Linking.openURL` for maps).

## Scripts

- `npm run dev` / `npm run build` / `npm run lint` / `npm run seed` / `npm run migrate` / `npm run selftest`
