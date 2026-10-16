import { db } from "./admin";

// Shared RTDB-backed sliding-window rate limiter for low-volume routes.
// State lives at /orgs/{orgId}/_rateLimits/{scope}_{uid} — client writes are
// denied by database rules; the backend uses admin SDK which bypasses rules,
// so the limit is shared across all server instances. Throws on exhaustion.
export async function rateLimit(orgId: string, scope: string, uid: string, max: number, windowMs: number): Promise<void> {
  const now = Date.now();
  const safeUid = uid.replace(/[^a-zA-Z0-9_-]/g, "_");
  const ref = db().ref(`/orgs/${orgId}/_rateLimits/${scope}_${safeUid}`);
  const res = await ref.transaction((cur: number[] | null) => {
    const hits = Array.isArray(cur) ? cur.filter((t) => typeof t === "number" && now - t < windowMs) : [];
    if (hits.length >= max) return; // abort: exhausted
    return [...hits, now].slice(-max);
  });
  if (!res.committed) {
    const err = new Error("Rate limit exceeded, try again later") as Error & { status?: number };
    err.status = 429;
    throw err;
  }
}
