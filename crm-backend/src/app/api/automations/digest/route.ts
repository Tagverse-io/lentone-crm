import { NextRequest } from "next/server";
import { preflight, json } from "@/lib/cors";
import { handle, requireCron } from "@/lib/auth";
import { db } from "@/lib/admin";
import { logAutomation } from "@/lib/log";
import { notify } from "@/lib/notify";

export function OPTIONS(req: NextRequest): Promise<Response> {
  return Promise.resolve(preflight(req));
}

// GET /api/automations/digest — daily digest email (0 3 * * *), CRON_SECRET protected.
// One batched email per user: tasks due, follow-ups due, overdue invoices.
export const GET = handle(async (req: NextRequest) => {
  requireCron(req);
  const database = db();
  const orgsSnap = await database.ref("/orgs").get();
  const orgIds = Object.keys((orgsSnap.val() ?? {}) as Record<string, unknown>);
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  let emailed = 0;

  for (const orgId of orgIds) {
    try {
      const [usersSnap, tasksSnap, fuSnap, invSnap] = await Promise.all([
        database.ref(`/orgs/${orgId}/users`).get(),
        database.ref(`/orgs/${orgId}/tasks`).get(),
        database.ref(`/orgs/${orgId}/followUps`).get(),
        database.ref(`/orgs/${orgId}/invoices`).get(),
      ]);
      const users = Object.entries((usersSnap.val() ?? {}) as Record<string, { email?: string }>);
      const tasks = Object.values((tasksSnap.val() ?? {}) as Record<string, { assignee?: string; due_date?: string; status?: string; title?: string }>);
      const fus = Object.values((fuSnap.val() ?? {}) as Record<string, { assignedTo?: string; dueAt?: string; done?: boolean; title?: string }>);
      const overdueCount = Object.values((invSnap.val() ?? {}) as Record<string, { status?: string }>).filter((i) => i.status === "overdue").length;

      for (const [uid, u] of users) {
        const myTasks = tasks.filter((t) => t.assignee === uid && t.status !== "done" && (t.due_date ?? "") <= tomorrow);
        const myFus = fus.filter((f) => !f.done && (!f.assignedTo || f.assignedTo === uid) && (f.dueAt ?? "").slice(0, 10) <= today);
        if (myTasks.length === 0 && myFus.length === 0 && overdueCount === 0) continue;
        const lines = [
          ...myTasks.map((t) => `• Task: ${t.title ?? "(untitled)"} (due ${t.due_date ?? "?"})`),
          ...myFus.map((f) => `• Follow-up: ${f.title ?? "(untitled)"}`),
          ...(overdueCount > 0 ? [`• ${overdueCount} overdue invoice(s)`] : []),
        ];
        try {
          const res = await notify({
            orgId, uid, type: "digest", title: "Daily digest",
            body: `Today: ${myTasks.length} task(s) due, ${myFus.length} follow-up(s) due, ${overdueCount} overdue invoice(s).\n${lines.slice(0, 10).join("\n")}`,
            link: "/dashboard", email: u.email,
          });
          if (res.emailSent) emailed++;
        } catch {
          // notify() logs internally.
        }
      }
      await logAutomation(orgId, { name: "digest", status: "ok", detail: `emailed ${emailed}` });
    } catch (e) {
      await logAutomation(orgId, { name: "digest", status: "error", detail: e instanceof Error ? e.message.slice(0, 200) : "failed" });
    }
  }
  return json(req, { ok: true, emailed });
});
