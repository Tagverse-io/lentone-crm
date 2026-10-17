import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getAdminDatabase } from "@/lib/firebase-admin";
import { getServerEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Worker directory row: /workers/{id} = { id, name, phone?, active, ... } */
interface WorkerRow {
  id?: string;
  name?: string;
  phone?: string;
  active?: boolean;
}

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

/** Digit-normalized tail of a phone (last 10 digits) so +91 / spaces / dashes match. */
function phoneTail(raw: string | undefined | null): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits.slice(-10);
}

/**
 * GET /api/app/worker?phone= — used by the Expo login screen to verify the
 * number belongs to a registered field worker and to get the CRM name + workerId.
 * Returns 404 if no worker matches the phone.
 */
export async function GET(req: NextRequest) {
  if (unauthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const phone = req.nextUrl.searchParams.get("phone")?.trim();
  if (!phone) {
    return NextResponse.json({ error: "phone query param is missing" }, { status: 400 });
  }
  if (phoneTail(phone).length < 10) {
    return NextResponse.json({ error: "Enter a valid 10-digit phone number" }, { status: 400 });
  }
  try {
    const db = getAdminDatabase();
    const snap = await db.ref("workers").get();
    const val = (snap.val() ?? {}) as Record<string, WorkerRow>;
    const workers = Object.entries(val).map(([id, w]) => ({ id, ...(w ?? {}) }));

    const target = phoneTail(phone);
    const matches = workers.filter((w) => phoneTail(w.phone) === target && target.length === 10);
    if (matches.length === 0) {
      return NextResponse.json(
        { error: "No worker is registered with this number in the CRM." },
        { status: 404 },
      );
    }
    // Prefer an active worker if there are multiple entries.
    const best =
      matches.find((w) => w.active !== false) ?? matches[matches.length - 1];
    return NextResponse.json({
      workerId: best.id,
      name: best.name ?? "",
      phone: best.phone ?? phone,
      active: best.active !== false,
    });
  } catch (err) {
    console.error("GET /api/app/worker failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
