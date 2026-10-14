import { createHash, createHmac, randomBytes } from "crypto";
import { google } from "googleapis";
import { getEnv } from "./env";
import { db } from "./admin";
import { encryptToken, decryptToken } from "./crypto";

export const GOOGLE_SCOPES = ["openid", "email", "profile", "https://www.googleapis.com/auth/calendar"];

function oauthClient(): InstanceType<typeof google.auth.OAuth2> {
  const env = getEnv();
  return new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REDIRECT_URI);
}

/** Signed state (uid + nonce + hmac) to prevent CSRF on the OAuth callback. */
export function signState(uid: string): string {
  const env = getEnv();
  const nonce = randomBytes(16).toString("hex");
  const payload = `${uid}.${nonce}`;
  const sig = createHmac("sha256", env.CRON_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

export function verifyState(state: string): string {
  const env = getEnv();
  const raw = Buffer.from(state, "base64url").toString("utf8");
  const [uid, nonce, sig] = raw.split(".");
  if (!uid || !nonce || !sig) throw new Error("Bad state");
  const expect = createHmac("sha256", env.CRON_SECRET).update(`${uid}.${nonce}`).digest("hex");
  if (!createHash("sha256").update(sig).digest("hex") || sig !== expect) throw new Error("Bad state signature");
  return uid;
}

export function connectUrl(uid: string): string {
  return oauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_SCOPES,
    state: signState(uid),
  });
}

export async function exchangeCode(code: string, uid: string): Promise<void> {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) throw new Error("No refresh token returned (did the user already consent? Reconnect with prompt=consent).");
  const encrypted = encryptToken(tokens.refresh_token);
  // Server-only path — locked down by security rules (no client read).
  await db().ref(`/private/${uid}/google`).set({
    refreshToken: encrypted,
    scope: (tokens.scope ?? GOOGLE_SCOPES.join(" ")),
    updatedAt: new Date().toISOString(),
  });
}

async function authedClient(uid: string): Promise<InstanceType<typeof google.auth.OAuth2>> {
  const snap = await db().ref(`/private/${uid}/google/refreshToken`).get();
  const encrypted = snap.val() as string | null;
  if (!encrypted) throw new Error("Google not connected for this user");
  const client = oauthClient();
  client.setCredentials({ refresh_token: decryptToken(encrypted) });
  return client;
}

export interface GoogleCalEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
}

export async function listGoogleEvents(uid: string, maxResults = 50): Promise<GoogleCalEvent[]> {
  const client = await authedClient(uid);
  const cal = google.calendar({ version: "v3", auth: client });
  const res = await cal.events.list({
    calendarId: "primary",
    timeMin: new Date().toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: "startTime",
  });
  return (res.data.items ?? []).map((e) => ({
    id: e.id ?? "",
    title: e.summary ?? "(untitled)",
    start: e.start?.dateTime ?? e.start?.date ?? "",
    end: e.end?.dateTime ?? e.end?.date ?? undefined,
  })).filter((e) => e.id && e.start);
}

/** Two-way sync: import upcoming Google events into /orgs/{orgId}/events (idempotent by googleId). */
export async function syncGoogleEvents(uid: string, orgId: string): Promise<number> {
  const events = await listGoogleEvents(uid, 100);
  const database = db();
  const existing = (await database.ref(`/orgs/${orgId}/events`).get()).val() as Record<string, { googleId?: string }> | null;
  const known = new Set(Object.values(existing ?? {}).map((e) => e.googleId).filter(Boolean));
  let imported = 0;
  for (const g of events) {
    if (known.has(g.id)) continue;
    const ref = database.ref(`/orgs/${orgId}/events`).push();
    await ref.set({ id: ref.key, title: g.title, start: g.start, end: g.end ?? null, googleId: g.id, source: "google", createdAt: new Date().toISOString() });
    imported++;
  }
  return imported;
}
