import { NextRequest } from "next/server";
import { preflight, json } from "@/lib/cors";
import { handle, requireCron } from "@/lib/auth";
import { db } from "@/lib/admin";
import { logAutomation } from "@/lib/log";
import { notify } from "@/lib/notify";

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
      const invoices = Object.entries((invSnap.val() ?? {}) as Record<string, { status?: string; dueDate?: string; amountDue?: number; number?: string; clientName?: string; clientId?: string }>);
      const fuSnap = await database.ref(`/orgs/${orgId}/followUps`).get();
      const existingFu = new Set(Object.values((fuSnap.val() ?? {}) as Record<string, { invoiceId?: string }>).map((f) => f.invoiceId).filter(Boolean));
      const usersSnap = await database.ref(`/orgs/${orgId}/users`).get();
      const admins = Object.entries((usersSnap.val() ?? {}) as Record<string, { role?: string; email?: string }>).filter(([, u]) => u.role === "admin");

      let processed = 0;
      for (const [id, inv] of invoices) {
        if (processed >= 25) break; // free-tier safety cap per org per run
        if ((inv.status === "sent" || inv.status === "partial") && (inv.dueDate ?? "") < today && (inv.amountDue ?? 0) > 0) {
          await database.ref(`/orgs/${orgId}/invoices/${id}`).update({ status: "overdue", updatedAt: new Date().toISOString() });
          marked++;
          if (!existingFu.has(id)) {
            const ref = database.ref(`/orgs/${orgId}/followUps`).push();
            await ref.set({
              id: ref.key, invoiceId: id, title: `Collect overdue ${inv.number ?? id}`,
              notes: `${inv.clientName ?? ""} owes ${inv.amountDue ?? 0}`, dueAt: new Date().toISOString(),
              done: false, createdAt: new Date().toISOString(),
            });
            followUps++;
          }
          for (const [uid, admin] of admins.slice(0, 5)) {
            try {
              await notify({ orgId, uid, type: "invoice_overdue", title: `Invoice overdue: ${inv.number ?? id}`, body: `${inv.clientName ?? "A client"} — ${inv.amountDue ?? 0} due since ${inv.dueDate}.`, link: "/invoices", email: admin.email });
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
