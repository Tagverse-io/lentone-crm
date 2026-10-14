# Migration Notes — bridgebreak (tagverse-crm) → tsk-crm

Source scanned: `/Users/user/Workspace/Projects/Strucureo_Projects/bridgebreak` (read-only, not modified).
Target: `/Users/user/Workspace/Projects/Strucureo_Projects/tsk-crm` (`crm-frontend`, `crm-backend`).

## Source snapshot
- Next.js 13.5.1 (pages + App Router mix), React 18, TypeScript, Tailwind 3 + shadcn/ui (Radix), `next-themes`, recharts, react-hook-form+zod, sonner, @hello-pangea/dnd (Kanban DnD), jspdf+autotable (PDF), date-fns.
- Data layer: **dual** — Supabase (`@supabase/supabase-js`, `supabase/` migrations) AND Firebase RTDB (`firebase` 12 + `firebase-admin` 13) via `lib/firebase/database.ts` (~2,700 lines, `// @ts-nocheck`, workspace-scoped `workspaces/{workspaceId}/{entity}`).
- Auth: email/password + Google, `lib/firebase/auth-context.tsx` (~467 lines) with workspace switching, invites (`lib/workspace/*`), roles (`lib/db/roles/api.ts`), permissions context.
- ~60 dashboard routes: overview, dashboard, leads, deals, pipeline, funnel, quotes, invoices (+new/[id]), payments, contracts, projects, tasks, contacts, calendar, marketing-calendar, social, campaigns, content, content-hub, media, assets, email, automation, analytics, reports, team, activity, docs, deliveries, field-monitoring, integrations (google/meta/whatsapp/website-enquiries), ai-assistant, mcp, enquiries, whatsapp-chats, settings, setup.
- Reusable pieces: `components/documents/*` (invoice/quote/contract forms + live preview + canvas renderer), `components/dialogs/*` (15 entity dialogs), `components/dashboard/*` (sidebar, header, kpi-card, overview, auth-guard, global-search), `components/ui/*` (full shadcn set), `lib/db/*` per-entity APIs, `lib/connectors/{whatsapp,meta,google}`, `lib/ads/*`, `lib/pdf-engine/*`, `lib/services/email.ts`, `lib/utils/encryption.ts`, hooks (`use-dashboard-metrics`, `use-permissions`, `use-event-bridge`, `use-smart-notifications`).
- Branding: hardcoded "TSK / bridgebreak / tagverse" strings, TSK GST/bank defaults, INR defaults.

## Reuse (adapted, converted to strict TS + App Router + CSS-variable theming)
- shadcn/ui primitives (button, card, input, dialog, table, badge, tabs, select) — copied in trimmed form.
- `kpi-card`, sidebar/header layout, global search, auth-guard pattern.
- Entity dialogs (lead, contact, quote, invoice, task, event, social-post) — simplified, typed, org-scoped.
- Documents module (items-table, pricing-summary incl. CGST/SGST/IGST, live preview, invoice-canvas print view) — reused, rebranded via `brand.config.ts`.
- Kanban pipeline with @hello-pangea/dnd (stages New→Contacted→Qualified→Proposal→Won→Lost).
- Calendar month view + marketing calendar + content calendar patterns → merged into one Central Calendar.
- Charts (recharts) on dashboard; dashboard metrics hook logic.
- Firebase RTDB access patterns (`cleanData`, push/get/update, subscriptions) — rewritten strict, org-scoped `/orgs/{orgId}/...`.
- Google OAuth connect/callback + encrypted refresh-token storage pattern (`lib/utils/encryption.ts` AES-GCM) → backend-only.
- Email service → rewritten as backend-only nodemailer Gmail SMTP singleton.
- RBAC model (owner/admin/manager/employee/viewer, module permissions) → simplified to `admin | member` per org per spec.

## Rewrite
- Data model: `workspace_id` → `orgId`, root `workspaces/...` + `users/...` → `/orgs/{orgId}/...` + `/private/{uid}/google` (server-only) per spec schema (leads, clients, contacts, followUps, quotations, invoices, payments, projects, tasks, socialAccounts, posts, videoProductions, events, notifications, users, automationsLog).
- Auth: email/password kept as secondary; Google sign-in primary with org membership/role check.
- Backend split out: all privileged logic (Google token exchange, Calendar sync, automations, mailer/notify, digest/overdue crons) as `crm-backend` Route Handlers with `firebase-admin`, ID-token verification, CORS allowlist, Zod validation.
- Notifications: old `use-smart-notifications` (client-only) → RTDB in-app (`/orgs/{orgId}/notifications/{uid}/{id}`) + Gmail SMTP email with per-user prefs.
- Social connectors: Meta/Google/WhatsApp ads-campaign clients → `SocialProvider` adapter interface with **stubbed** implementations (documented).
- Theming: hardcoded colors/brand → `brand.config.ts` + CSS variables.
- Env handling: scattered env → Zod-validated env in both projects, `.env.example` committed, secrets never on client.

## Drop (dead code / out of scope)
- Supabase entirely (client, migrations, `lib/supabase/*`, `lib/db/*` Supabase variants) — Firebase RTDB only per spec (no PostgreSQL/Prisma).
- Stripe billing, 2FA TOTP, MCP server, AI assistant/OpenAI chat, Netlify config, ads-sync engine, WhatsApp Cloud API client, Google Drive assets, deliveries/field-monitoring, contracts e-sign, tally engine, COA/statutory reports — not in spec; removed to stay within Vercel Hobby + Firebase Spark limits.
- Test-sprite suites, scratch/repomix artefacts, one-off fix scripts (`fix_*.py`, `patch_*.py`, `check_*.js`, `scratch.js`), `.bolt/.claude/.cursor/mcp` configs.
- Old `middleware.ts` session handling (replaced by client AuthContext + backend token verification).

## Brand scrub
- Removed: "TSK", "bridgebreak", "tagverse", old logo/quotes/invoice footers, TSK GSTIN/bank/UPI defaults. All brand surface now reads from `brand.config.ts` (env-overridable); emails/PDFs use the same config.
