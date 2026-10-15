# tsk-crm — white-labelled CRM (Next.js + Firebase)

Two separately-deployable Next.js (App Router, TypeScript) projects — no PostgreSQL, no Prisma, no custom server.
**The frontend UI is a faithful port of `bridgebreak`**: full shadcn/ui library,
dashboard shell (sidebar/header/search/theme), entity dialogs, documents module
(quote/invoice forms + live preview + PDF), Kanban pipeline, dashboard, CRM,
sales, projects, calendar and settings pages. Data layer repointed from
`workspaces/{id}` to org-scoped `/orgs/{orgId}`, auth simplified to a
single-org model (Google + email/password), legacy direct-email sends removed
(backend Gmail notifier is the single email path).

| Project | Vercel project | Purpose |
|---|---|---|
| `crm-frontend` | #1 (UI only) | All pages, Firebase Auth (Google), RTDB reads/writes via client SDK, calls backend for privileged work. Port **3000**. |
| `crm-backend` | #2 (API only) | Route Handlers (`/api/*`) with `firebase-admin`: Google OAuth/Calendar, automations, notifications. Port **4000**. |

Migrated from `bridgebreak` (read-only reference) — see `MIGRATION_NOTES.md` for reuse/rewrite/drop decisions. Old branding (TSK / bridgebreak / tagverse) removed everywhere, including emails and PDFs.

## Architecture

- **Frontend** → Firebase client SDK (Realtime Database) for CRUD; → backend for Google OAuth/Calendar sync, automations, notifications.
- **Backend** verifies the Firebase ID token (`Authorization: Bearer <token>`) on every route except cron routes (which use `CRON_SECRET`). CORS allows only `FRONTEND_URL` (OPTIONS preflight handled).
- **Secrets live ONLY in the backend**: Google client secret, Gmail app password, refresh tokens (AES-256-GCM with `TOKEN_ENCRYPTION_KEY`, stored at server-only `/private/{uid}/google`, denied to clients by `database.rules.json`).
- **Database**: Firebase Realtime Database under `/orgs/{orgId}/…`: leads, clients, contacts, followUps, quotations, invoices, payments, projects, tasks, socialAccounts, posts, videoProductions, events, notifications (`…/notifications/{uid}/{id}`), users, automationsLog. Roles: `admin | member` per org.
- **Serverless-safe**: no local file writes, no long-running jobs. Vercel Hobby daily crons (`0 3 * * *`) hit `/api/automations/overdue` and `/api/automations/digest`.

## White-labelling

- Single `brand.config.ts` in each project (env-overridable): appName, logo, favicon, primary/secondary colors, font, support email, currency, locale, per-module feature flags.
- Theming via CSS variables (`--brand-primary`, `--brand-secondary`, `--brand-font`) — changing config/env rebrands everything, including emails and PDFs.
- Org-ready data model (`orgId`); each module toggled by `NEXT_PUBLIC_MODULE_*` flags.

## Features

- **Dashboard**: revenue collected, leads, clients, projects, tasks KPIs + leads-by-stage chart + overdue list.
- **CRM**: leads (filter + CRUD), Kanban pipeline (drag & drop, New→Contacted→Qualified→Proposal→Won→Lost), clients, contacts, follow-ups.
- **Sales**: quotations (accept → auto-invoice), invoices (print + PDF download), payments (auto-updates invoice).
- **Projects & Tasks**: progress bars, deadlines, assignments.
- **Marketing**: social accounts + posts (content calendar month view), video production Kanban.
- **Central Calendar**: one normalized `CalendarEvent` merging CRM events, tasks, projects, follow-ups, social posts, Google events — colour-coded with per-source filters.
- **Automations** (event-driven `POST /api/automations/*`, idempotent; every run logged to `automationsLog`): lead Won → client + project; quotation accepted → invoice (+ project if configured); payment received → invoice status/totals; invoice overdue → follow-up (daily cron); calendar/tasks auto-surface on Central Calendar.
- **Notifications**: in-app bell (unread count, dropdown, mark read/all, realtime) + Gmail SMTP email (`mailer.ts` singleton + `notify.ts` fan-out honouring `/users/{uid}/notificationPrefs`), branded HTML templates, per-type mute, test route, daily digest cron (one batched email/user; ~500/day Gmail limit respected; failures logged, never crash automations).
- **MCP server**: every backend capability is also an MCP tool at `POST https://<backend>.vercel.app/api/mcp` (Streamable HTTP, JSON-RPC 2.0, protocol `2025-06-18`): `health`, `google_connect`, `google_events`, `google_sync`, `lead_won`, `quotation_accepted`, `payment_received`, `run_overdue`, `run_digest`, `send_notification`. Auth: `Authorization: Bearer <CRON_SECRET>` (service mode) or a Firebase ID token (user mode, org membership enforced; `run_overdue`/`run_digest` are service-only). `tools/list` needs no auth; `tools/call` does. The frontend calls no `/api/*` of its own — all privileged work goes through the backend REST routes or MCP.
- **MCP OAuth (for ChatGPT-style clients)**: RFC 8414 discovery at `/.well-known/oauth-authorization-server`, consent at `/api/oauth/authorize`, tokens at `/api/oauth/token` (code + refresh rotation). Single-tenant: approving binds tokens to the org's first admin (`MCP_OAUTH_ORG_ID`, default `default`); set `MCP_OAUTH_CLIENT_SECRET` to require confidential clients. Only connect clients you trust — approval grants full CRM access.

## Social integrations (STUBBED)

`crm-backend/src/lib/social.ts` defines the `SocialProvider` interface with stub implementations for Facebook/Instagram, LinkedIn, X, YouTube: they persist accounts/posts to RTDB only and **do not call any live platform API**. The frontend Social page is labelled STUB. To go live: implement OAuth + publish calls per provider, store tokens under `/private/`, add routes.

## Local run

```bash
# 1. Frontend
cd crm-frontend && npm install && npm run dev   # http://localhost:3000
# 2. Backend (second terminal)
cd crm-backend && npm install && npm run dev    # http://localhost:4000
# 3. Seed demo data (after first Google sign-in → get uid from Firebase Console)
cd crm-backend && SEED_ADMIN_UID=<uid> SEED_ADMIN_EMAIL=<you@x.com> npm run seed
```

Env files: copy `.env.example` → `.env.local` in each project and fill in. `.env.local` is git-ignored. Env vars are Zod-validated at startup — missing/invalid values fail with a clear message.
`crm-frontend/.npmrc` pins `legacy-peer-deps=true` (React 19 + day-picker v8) — required for Vercel builds too.

## Deploy (Vercel, Hobby tier)

1. Create **two** Vercel projects with Root Directories `crm-frontend` and `crm-backend` (or two repos).
2. Frontend env (Production + Preview): all `NEXT_PUBLIC_*` with prod values (`NEXT_PUBLIC_BACKEND_URL` = backend URL).
3. Backend env (Production + Preview): `FRONTEND_URL` = frontend URL, `GOOGLE_REDIRECT_URI` = `https://<backend>.vercel.app/api/google/callback`, Gmail + `CRON_SECRET` + Firebase service key.
4. Backend `vercel.json` already declares both daily crons. Stay within free-tier limits.
5. Deploy `database.rules.json`: `firebase deploy --only database`.

## How to white-label for a new client

1. Copy this repo; set `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_PRIMARY_COLOR`, `NEXT_PUBLIC_SECONDARY_COLOR`, logo/favicon, font, `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_CURRENCY`, `NEXT_PUBLIC_LOCALE` in frontend env; `APP_NAME`, `PRIMARY_COLOR`, `MAIL_FROM_NAME`, `SUPPORT_EMAIL`, `CURRENCY` in backend env.
2. Add `public/logo.svg` + favicon per client.
3. Create a new Firebase project → update all `NEXT_PUBLIC_FIREBASE_*`, backend `FIREBASE_*`, deploy `database.rules.json`.
4. New Google OAuth client → update `GOOGLE_CLIENT_ID/SECRET`, redirect URIs, Calendar API + consent screen.
5. New Gmail account + app password → `GMAIL_USER`/`GMAIL_APP_PASSWORD` (belongs to that account; 2-Step Verification on).
6. Toggle modules with `NEXT_PUBLIC_MODULE_*` flags; set `NEXT_PUBLIC_DEFAULT_ORG_ID` per tenant; promote first user to `admin` in RTDB.
7. Update Vercel envs (Production + Preview), redeploy, smoke-test `/api/notifications/test`.

## Manual steps (must do in consoles)

1. Firebase Console → Authentication → enable **Google** AND **Email/Password**
   providers; add authorized domains (localhost + both Vercel domains).
2. Firebase Console → Project settings → Service accounts → generate private key → fill `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (keep `\n` escaped).
3. Deploy `database.rules.json` (`firebase deploy --only database`).
4. Google Cloud Console → OAuth client: authorized JavaScript origins (frontend local + prod) and redirect URIs (`http://localhost:4000/api/google/callback`, `https://<backend>.vercel.app/api/google/callback`); enable **Google Calendar API**; add test users or publish consent screen.
5. Confirm 2-Step Verification is on for the Gmail account and the app password belongs to it; set `GMAIL_USER`.
6. Add all backend env vars (Gmail + `CRON_SECRET`) to Vercel (Production + Preview).
7. Call `/api/notifications/test` and check **spam** on first run.
8. Rotate the Google client secret and revoke the shared Gmail app password; use fresh ones in production.

## Decisions made (no questions asked)

- Next.js 15 + React 19, Tailwind 3, `next-themes`, `@hello-pangea/dnd`, `recharts`, `jspdf` (frontend); `firebase-admin`, `googleapis`, `nodemailer` (backend).
- Dropped from source: Supabase, Stripe, 2FA, AI/MCP, WhatsApp/ads/drive integrations, deliveries/field modules (out of spec, free-tier safety).
- Roles simplified to `admin | member`; first login auto-provisions `member` (promote via seed/console).
- Google OAuth `state` is HMAC-signed with `CRON_SECRET`; callback redirects to `/calendar?google=…`.
- Cron caps: 25 invoices/org/run (overdue), one digest email/user/day.
