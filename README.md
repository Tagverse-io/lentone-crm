# Lentone CRM — field-force web ERP (Next.js + Firebase)

Single Next.js App Router project in `crm-frontend` (shadcn/ui, white theme, sidebar layout).
Firebase is the only backend: Realtime Database for data, Firebase Auth for web login.
No other database.

**Modules:** Dashboard · Clients · Lead Management · Field Force · Revenue (Quotations, Invoices) · Delivery · Settings

**Realtime link to the Expo field app** (Vercel serverless cannot hold persistent WebSockets):
- Expo app → ERP: HTTPS webhook `POST /api/app/events` (Bearer `APP_API_KEY`, writes via firebase-admin).
- ERP web UI: Firebase Realtime Database listeners (`onValue`) for live dashboard, worker locations and deliveries.
- ERP → app: `GET /api/app/tasks?workerId=` + `GET /api/app/stream?workerId=` (SSE, 30s polling fallback).
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

### Seed demo data (FMCG hotels, restaurants, bakeries)

```bash
cd crm-frontend
npm run seed
```

### Deploy (Vercel)

1. New Vercel project, Root Directory `crm-frontend`.
2. Add all env vars above (Production + Preview).
3. Deploy. SSE duration for `/api/app/stream` is set in `crm-frontend/vercel.json`.

### Expo app contract

See `docs/app-api.md` for endpoints + example requests (login/logout, background `location` with Google Maps URL, task list, proof-photo upload ≤500 KB, `Linking.openURL` for maps).

## Scripts

- `npm run dev` / `npm run build` / `npm run lint` / `npm run seed`
