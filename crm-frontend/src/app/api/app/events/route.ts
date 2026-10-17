import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { timingSafeEqual } from "crypto";
import { getAdminDatabase } from "@/lib/firebase-admin";
import { getServerEnv } from "@/lib/env";
import { isMapsUrl } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Max decoded proof-photo size: 500 KB. Anything bigger is rejected. */
const MAX_PROOF_BYTES = 500 * 1024;

const EventSchema = z.object({
  workerId: z.string().min(1, "workerId is missing"),
  workerName: z.string().optional(),
  phone: z.string().optional(),
  event: z.enum(["login", "logout", "location", "task_update", "delivery_update"]),
  mapsUrl: z.string().optional(),
  timestamp: z.string().min(1, "timestamp is missing"),
  taskId: z.string().optional(),
  status: z.string().optional(),
  denyReason: z.string().optional(),
  deliveryId: z.string().optional(),
  proofBase64: z.string().optional(),
});

const TASK_STATUSES = ["Assigned", "In Progress", "Done"];
const DELIVERY_STATUSES = ["Pending", "Out for Delivery", "Delivered"];

/**
 * App-side task actions from the Expo app. The CRM database keeps its three
 * canonical statuses (Assigned | In Progress | Done); accept/deny are recorded
 * as fields on the task so the poll endpoint can derive the worker's view, and
 * the admin sees the decision in the task history.
 */
function normalizeTaskUpdate(status: string | undefined): { action: "accept" | "deny" | "start" | "complete"; crmStatus?: string } | null {
  if (!status) return null;
  const s = status.trim().toLowerCase();
  if (s === "accepted") return { action: "accept" };
  if (s === "denied") return { action: "deny" };
  if (s === "in_progress" || s === "started") return { action: "start", crmStatus: "In Progress" };
  if (s === "completed" || s === "done" || s === "Done") return { action: "complete", crmStatus: "Done" };
  // Server-canonical forms (case-sensitive) also accepted.
  if (status === "In Progress") return { action: "start", crmStatus: "In Progress" };
  if (status === "Done") return { action: "complete", crmStatus: "Done" };
  if (status === "Assigned") return { action: "accept" };
  return null;
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

function stripDataPrefix(b64: string): string {
  const i = b64.indexOf("base64,");
  return i >= 0 ? b64.slice(i + "base64,".length) : b64;
}

export async function POST(req: NextRequest) {
  if (unauthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = EventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") },
      { status: 400 },
    );
  }
  const e = parsed.data;
  const ts = new Date(e.timestamp);
  if (Number.isNaN(ts.getTime())) {
    return NextResponse.json({ error: "timestamp: not a valid date" }, { status: 400 });
  }

  const db = getAdminDatabase();
  const stamp = new Date().toISOString();
  const by = e.workerName ?? e.workerId;
  const hist = async (entity: string, id: string, action: string, detail?: string) => {
    await db.ref(`history/${entity}/${id}`).push({ action, ...(detail ? { detail } : {}), at: stamp, by });
  };

  try {
    switch (e.event) {
      case "login":
      case "logout": {
        const date = e.timestamp.slice(0, 10); // YYYY-MM-DD
        const attRef = db.ref(`attendance/${e.workerId}/${date}`);
        // Upsert worker directory entry.
        await db.ref(`workers/${e.workerId}`).update({
          ...(e.workerName ? { name: e.workerName } : {}),
          ...(e.phone ? { phone: e.phone } : {}),
          active: true,
          updatedAt: stamp,
        });
        if (e.event === "login") {
          await attRef.update({ date, loginAt: e.timestamp });
        } else {
          const snap = await attRef.get();
          const prev = (snap.val() ?? {}) as { loginAt?: string };
          const patch: Record<string, unknown> = { date, logoutAt: e.timestamp };
          if (prev.loginAt) {
            const ms = ts.getTime() - new Date(prev.loginAt).getTime();
            if (ms >= 0) patch.hoursWorked = Math.round((ms / 3_600_000) * 100) / 100;
          }
          await attRef.update(patch);
        }
        return NextResponse.json({ ok: true });
      }

      case "location": {
        if (!e.mapsUrl || !isMapsUrl(e.mapsUrl)) {
          return NextResponse.json({ error: "mapsUrl: must be a Google Maps link (maps.google.com, google.com/maps or maps.app.goo.gl)" }, { status: 400 });
        }
        const latest = { mapsUrl: e.mapsUrl, timestamp: e.timestamp, ...(e.workerName ? { workerName: e.workerName } : {}) };
        await db.ref(`locations/${e.workerId}/latest`).set(latest);
        await db.ref(`locations/${e.workerId}/history`).push({ mapsUrl: e.mapsUrl, timestamp: e.timestamp });
        return NextResponse.json({ ok: true });
      }

      case "task_update": {
        if (!e.taskId) return NextResponse.json({ error: "taskId is missing" }, { status: 400 });
        if (!e.status) return NextResponse.json({ error: "status is missing" }, { status: 400 });
        const { action, crmStatus } = normalizeTaskUpdate(e.status) ?? {
          action: null as never,
        };
        if (!action) {
          return NextResponse.json(
            { error: "status: must be one of accepted, denied, in_progress, completed (or Assigned, In Progress, Done)" },
            { status: 400 },
          );
        }
        if (action === "deny" && !e.denyReason) {
          return NextResponse.json({ error: "denyReason is required when denying a task" }, { status: 400 });
        }
        const taskSnap = await db.ref(`tasks/${e.taskId}`).get();
        if (!taskSnap.exists()) return NextResponse.json({ error: "Task not found" }, { status: 404 });
        const task = taskSnap.val() as { workerId?: string };
        if (task.workerId && task.workerId !== e.workerId) {
          return NextResponse.json({ error: "Task is not assigned to this worker" }, { status: 403 });
        }
        switch (action) {
          case "accept": {
            await db.ref(`tasks/${e.taskId}`).update({
              acceptedAt: stamp,
              denyReason: null,
              deniedAt: null,
              updatedAt: stamp,
            });
            await hist("tasks", e.taskId, "Task accepted", `via Expo app (${by})`);
            break;
          }
          case "deny": {
            await db.ref(`tasks/${e.taskId}`).update({
              denyReason: e.denyReason ?? null,
              deniedAt: stamp,
              updatedAt: stamp,
            });
            await hist("tasks", e.taskId, "Task denied", `${e.denyReason} (via Expo app, ${by})`);
            break;
          }
          case "start":
          case "complete": {
            if (crmStatus) {
              const patch: Record<string, unknown> = { status: crmStatus, updatedAt: stamp };
              if (action === "start") patch.startedAt = stamp;
              await db.ref(`tasks/${e.taskId}`).update(patch);
            }
            await hist("tasks", e.taskId, `Status → ${crmStatus}`, `via Expo app (${by})`);
            break;
          }
        }
        return NextResponse.json({ ok: true });
      }

      case "delivery_update": {
        if (!e.deliveryId) return NextResponse.json({ error: "deliveryId is missing" }, { status: 400 });
        if (!e.status || !DELIVERY_STATUSES.includes(e.status)) {
          return NextResponse.json({ error: `status: must be one of ${DELIVERY_STATUSES.join(", ")}` }, { status: 400 });
        }
        const delSnap = await db.ref(`deliveries/${e.deliveryId}`).get();
        if (!delSnap.exists()) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
        const patch: Record<string, unknown> = { status: e.status, updatedAt: stamp };
        if (e.mapsUrl) {
          if (!isMapsUrl(e.mapsUrl)) {
            return NextResponse.json({ error: "mapsUrl: must be a Google Maps link (maps.google.com, google.com/maps or maps.app.goo.gl)" }, { status: 400 });
          }
          patch.mapsUrl = e.mapsUrl;
        }
        if (e.proofBase64) {
          const raw = stripDataPrefix(e.proofBase64);
          let bytes = 0;
          try {
            bytes = Buffer.from(raw, "base64").length;
          } catch {
            return NextResponse.json({ error: "proofBase64: not valid base64" }, { status: 400 });
          }
          if (bytes > MAX_PROOF_BYTES) {
            return NextResponse.json({ error: "proofBase64: photo exceeds 500 KB after app-side compression" }, { status: 413 });
          }
          // Stored ONLY at /deliveryProofs/{deliveryId} — never under a listed path.
          await db.ref(`deliveryProofs/${e.deliveryId}`).set({ proofBase64: raw, updatedAt: stamp });
          patch.proofAt = e.timestamp;
        }
        await db.ref(`deliveries/${e.deliveryId}`).update(patch);
        await hist("deliveries", e.deliveryId, `Status → ${e.status}`, `via Expo app (${by})`);
        // Delivered cascades: task Done + order Delivered + history.
        if (e.status === "Delivered") {
          const d = delSnap.val() as { taskId?: string; orderId?: string; proofAt?: string };
          if (d.taskId) {
            await db.ref(`tasks/${d.taskId}`).update({ status: "Done", updatedAt: stamp });
            await hist("tasks", d.taskId, "Task done", "Delivery delivered (Expo app)");
          }
          if (d.orderId) {
            await db.ref(`orders/${d.orderId}`).update({ status: "Delivered", updatedAt: stamp });
            await hist("orders", d.orderId, "Order delivered", `Delivery ${e.deliveryId} (Expo app)`);
          }
        }
        return NextResponse.json({ ok: true });
      }
    }
  } catch (err) {
    console.error("POST /api/app/events failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
