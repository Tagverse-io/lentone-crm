import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getAdminDatabase } from "@/lib/firebase-admin";
import { getServerEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized(req: NextRequest): boolean {
  let expected = "";
  try {
    expected = getServerEnv().APP_API_KEY;
  } catch {
    return true;
  }
  const header = req.headers.get("authorization") ?? "";
  const m = header.match(/^Bearer\s+(.+)$/);
  if (!m) return true;
  const a = Buffer.from(m[1]);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return true;
  return !timingSafeEqual(a, b);
}

function toList<T>(val: unknown): (T & { id: string })[] {
  if (!val || typeof val !== "object") return [];
  return Object.entries(val as Record<string, unknown>)
    .filter(([, v]) => v && typeof v === "object")
    .map(([id, v]) => ({ id, ...(v as object) }) as T & { id: string });
}

/** GET /api/app/tasks?workerId= — the worker's open tasks and deliveries. */
export async function GET(req: NextRequest) {
  if (unauthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workerId = req.nextUrl.searchParams.get("workerId");
  if (!workerId) {
    return NextResponse.json({ error: "workerId query param is missing" }, { status: 400 });
  }
  try {
    const db = getAdminDatabase();
    const [tasksSnap, deliveriesSnap] = await Promise.all([db.ref("tasks").get(), db.ref("deliveries").get()]);
    const tasks = toList<{ workerId?: string; status?: string }>(tasksSnap.val()).filter(
      (t) => t.workerId === workerId && t.status !== "Done",
    );
    const deliveries = toList<{ workerId?: string; status?: string }>(deliveriesSnap.val()).filter(
      (d) => d.workerId === workerId && d.status !== "Delivered",
    );
    return NextResponse.json({ tasks, deliveries });
  } catch (err) {
    console.error("GET /api/app/tasks failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
