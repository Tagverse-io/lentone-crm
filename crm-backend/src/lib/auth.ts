import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "./env";
import { auth as adminAuth } from "./admin";

export interface VerifiedUser {
  uid: string;
  email?: string;
}

/** Verify `Authorization: Bearer <Firebase ID token>`. Throws Response on failure. */
export async function requireUser(req: NextRequest): Promise<VerifiedUser> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    throw NextResponse.json({ error: "Missing Authorization Bearer token" }, { status: 401 });
  }
  const token = header.slice("Bearer ".length).trim();
  if (!token) throw NextResponse.json({ error: "Empty token" }, { status: 401 });
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    throw NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }
}

/** Verify cron shared secret: `Authorization: Bearer <CRON_SECRET>`. */
export function requireCron(req: NextRequest): void {
  const env = getEnv();
  const header = req.headers.get("authorization") ?? "";
  if (header !== `Bearer ${env.CRON_SECRET}`) {
    throw NextResponse.json({ error: "Unauthorized cron" }, { status: 401 });
  }
}

/** Ensure the verified user is a member of the org (role check for RBAC). */
export async function requireOrgMember(orgId: string, uid: string): Promise<string> {
  const { db } = await import("./admin");
  const snap = await db().ref(`/orgs/${orgId}/users/${uid}/role`).get();
  const role = snap.val() as string | null;
  if (!role) throw NextResponse.json({ error: "Not a member of this org" }, { status: 403 });
  return role;
}

function isThrownResponse(e: unknown): e is NextResponse {
  return e instanceof NextResponse;
}

/** Wrap a handler so thrown NextResponse errors are returned properly. */
export function handle<T extends unknown[]>(
  fn: (...args: T) => Promise<NextResponse>,
): (...args: T) => Promise<NextResponse> {
  return async (...args: T) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (isThrownResponse(e)) return e;
      // Never log tokens or secrets here.
      console.error("API error");
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}
