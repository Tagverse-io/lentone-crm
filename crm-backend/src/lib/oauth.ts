import { randomBytes, createHash } from "crypto";
import { db } from "./admin";

// ---------------------------------------------------------------------------
// Minimal OAuth 2.0 authorization server for MCP clients (e.g. ChatGPT)
// that require an OAuth flow instead of a static bearer token.
// Single-tenant model: approving issues tokens bound to the org's first
// admin user. Anyone who can open the consent URL and click Approve gets a
// token with that admin's access — only share/connect servers you trust.
// ---------------------------------------------------------------------------

const CODE_TTL_MS = 10 * 60 * 1000;
const ACCESS_TTL_MS = 30 * 24 * 3600 * 1000;
const REFRESH_TTL_MS = 90 * 24 * 3600 * 1000;

function rid(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

function sha(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function oauthOrg(): string {
  return process.env.MCP_OAUTH_ORG_ID && process.env.MCP_OAUTH_ORG_ID.trim() !== ""
    ? process.env.MCP_OAUTH_ORG_ID
    : "default";
}

export function oauthClientSecret(): string {
  return process.env.MCP_OAUTH_CLIENT_SECRET ?? "";
}

/** First admin uid in the org — the identity OAuth tokens bind to. */
export async function orgAdminUid(orgId: string): Promise<string | null> {
  const snap = await db().ref(`/orgs/${orgId}/users`).get();
  if (!snap.exists()) return null;
  const users = snap.val() as Record<string, { role?: string }>;
  return Object.entries(users).find(([, u]) => u.role === "admin")?.[0] ?? null;
}

export interface TokenRecord {
  uid: string;
  orgId: string;
  scope: string;
  createdAt: string;
  expiresAt: string;
}

export async function issueCode(uid: string, orgId: string, redirectUri: string, scope: string): Promise<string> {
  const code = rid(24);
  await db().ref(`/private/oauth/codes/${sha(code)}`).set({
    uid, orgId, redirectUri, scope,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  });
  return code;
}

export async function consumeCode(code: string, redirectUri: string): Promise<TokenRecord & { codeHash: string }> {
  const hash = sha(code);
  const snap = await db().ref(`/private/oauth/codes/${hash}`).get();
  const rec = (snap.exists() ? snap.val() : null) as (TokenRecord & { redirectUri?: string }) | null;
  if (!rec) throw new Error("invalid_grant");
  if (Date.now() > new Date(rec.expiresAt).getTime()) throw new Error("invalid_grant");
  if (rec.redirectUri && rec.redirectUri !== redirectUri) throw new Error("invalid_grant");
  await db().ref(`/private/oauth/codes/${hash}`).remove();
  return { ...rec, codeHash: hash };
}

export async function issueTokens(uid: string, orgId: string, scope: string): Promise<{ access: string; refresh: string; expiresIn: number }> {
  const access = rid(32);
  const refresh = rid(32);
  const now = Date.now();
  const base = { uid, orgId, scope, createdAt: new Date(now).toISOString() };
  await db().ref(`/private/oauth/tokens/${sha(access)}`).set({ ...base, expiresAt: new Date(now + ACCESS_TTL_MS).toISOString() });
  await db().ref(`/private/oauth/refresh/${sha(refresh)}`).set({ ...base, accessHash: sha(access), expiresAt: new Date(now + REFRESH_TTL_MS).toISOString() });
  return { access, refresh, expiresIn: Math.floor(ACCESS_TTL_MS / 1000) };
}

export async function rotateRefresh(refresh: string): Promise<{ access: string; refresh: string; expiresIn: number }> {
  const hash = sha(refresh);
  const snap = await db().ref(`/private/oauth/refresh/${hash}`).get();
  const rec = (snap.exists() ? snap.val() : null) as (TokenRecord & { accessHash?: string }) | null;
  if (!rec || Date.now() > new Date(rec.expiresAt).getTime()) throw new Error("invalid_grant");
  if (rec.accessHash) await db().ref(`/private/oauth/tokens/${rec.accessHash}`).remove();
  await db().ref(`/private/oauth/refresh/${hash}`).remove();
  return issueTokens(rec.uid, rec.orgId, rec.scope);
}

export async function verifyAccessToken(token: string): Promise<TokenRecord | null> {
  const snap = await db().ref(`/private/oauth/tokens/${sha(token)}`).get();
  const rec = (snap.exists() ? snap.val() : null) as TokenRecord | null;
  if (!rec) return null;
  if (Date.now() > new Date(rec.expiresAt).getTime()) return null;
  return rec;
}
