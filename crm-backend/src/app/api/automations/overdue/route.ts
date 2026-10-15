import { NextRequest } from "next/server";
import { preflight, json } from "@/lib/cors";
import { handle, requireCron } from "@/lib/auth";
import { db } from "@/lib/admin";
import { logAutomation } from "@/lib/log";
import { notify } from "@/lib/notify";
import { formatMoneyForOrg } from "@/lib/settings";

export function OPTIONS(req: NextRequest): Promise<Response> {
  return Promise.resolve(preflight(req));
}

// GET /api/automations/overdue — daily cron (0 3 * * *), CRON_SECRET protected.
// Marks past-due invoices overdue + creates one follow-up each (idempotent).
export const GET = handle(async (req: NextRequest) => {
  requireCron(req);
  const database = db();
  const orgsSnap = await database.ref("/orgs").get();
  const orgIds = Object.keys((orgsSnap.val() ?? {}) as Record<string, unknown>);
  const today = new Date().toISOString().slice(0, 10);
  let marked = 0;
  let followUps = 0;

  for (const orgId of orgIds) {
    try {
      const invSnap = await database.ref(`/orgs/${orgId}/invoices`).get();
      const invoices = Object.entries((invSnap.val() ?? {}) as Record<string, {
        status?: string; due_date?: string; amount_due?: number;
        invoice_number?: string; client_name?: string;
      }>);
      const fuSnap = await database.ref(`/orgs/${orgId}/followUps`).get();
      const existingFu = new Set(Object.values((fuSnap.val() ?? {}) as Record<string, { invoiceId?: string }>).map((f) => f.invoiceId).filter(Boolean));
      const usersSnap = await database.ref(`/orgs/${orgId}/users`).get();
      const admins = Object.entries((usersSnap.val() ?? {}) as Record<string, { role?: string; email?: string }>).filter(([, u]) => u.role === "admin");

      let processed = 0;
      for (const [id, inv] of invoices) {
        if (processed >= 25) break; // free-tier safety cap per org per run
        if ((inv.status === "pending" || inv.status === "partially_paid") && (inv.due_date ?? "") < today && (inv.amount_due ?? 0) > 0) {
          await database.ref(`/orgs/${orgId}/invoices/${id}`).update({ status: "overdue", updated_at: new Date().toISOString() });
          marked++;
          if (!existingFu.has(id)) {
            const ref = database.ref(`/orgs/${orgId}/followUps`).push();
            await ref.set({
              id: ref.key, invoiceId: id, title: `Collect overdue ${inv.invoice_number ?? id}`,
              notes: `${inv.client_name ?? ""} owes ${inv.amount_due ?? 0}`, dueAt: new Date().toISOString(),
              done: false, createdAt: new Date().toISOString(),
            });
            followUps++;
          }
          for (const [uid, admin] of admins.slice(0, 5)) {
            try {
              const money = await formatMoneyForOrg(orgId, inv.amount_due ?? 0);
              await notify({ orgId, uid, type: "invoice_overdue", title: `Invoice overdue: ${inv.invoice_number ?? id}`, body: `${inv.client_name ?? "A client"} — ${money} due since ${inv.due_date}.`, link: "/invoices", email: admin.email });
            } catch {
              // notify() logs internally.
            }
          }
          processed++;
        }
      }
      await logAutomation(orgId, { name: "overdue", status: "ok", detail: `marked ${marked}, follow-ups ${followUps}` });
    } catch (e) {
      await logAutomation(orgId, { name: "overdue", status: "error", detail: e instanceof Error ? e.message.slice(0, 200) : "failed" });
    }
  }
  return json(req, { ok: true, marked, followUps });
});
