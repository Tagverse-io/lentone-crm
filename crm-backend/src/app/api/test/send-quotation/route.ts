import { NextRequest } from "next/server";
import { z } from "zod";
import { preflight, json, jsonError } from "@/lib/cors";
import { handle, requireUser, requireOwnerOrAdmin } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { getOrgSettings, formatMoneyForSettings } from "@/lib/settings";
import { sendMail, brandedEmail, escapeHtml } from "@/lib/mailer";
import { logAutomation } from "@/lib/log";

// Test mode: body carries ONLY orgId. The recipient is ALWAYS read from
// org settings (notifications.test_email) at runtime — never from the
// request, env, fixtures, or hardcoded values.
const Body = z.object({ orgId: z.string().min(1) });

export function OPTIONS(req: NextRequest): Promise<Response> {
  return Promise.resolve(preflight(req));
}

// POST /api/test/send-quotation — sends a TEST quotation email to the Settings
// test recipient only. Company/currency/tax/prefix/logo come from Settings.
export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser(req);
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(req, "Invalid body: orgId required", 400);
  const { orgId } = parsed.data;
  await requireOwnerOrAdmin(orgId, user.uid);
  try {
    await rateLimit(orgId, "send-quotation", user.uid, 5, 10 * 60 * 1000);
  } catch {
    return jsonError(req, "Rate limit exceeded, try again later", 429);
  }

  const s = await getOrgSettings(orgId);
  const to = (s.notifications.test_email || "").trim();
  if (!/.+@.+\..+/.test(to)) return jsonError(req, "Add a test email in Settings", 400);

  const unit = s.general.units[0] || "pcs";
  const qty = 1;
  const unitPrice = 25000;
  const subtotal = qty * unitPrice;
  const cgst = (subtotal * s.branding.tax_cgst) / 100;
  const sgst = (subtotal * s.branding.tax_sgst) / 100;
  const igst = (subtotal * s.branding.tax_igst) / 100;
  const total = subtotal + cgst + sgst + igst;
  const money = (v: number): string => formatMoneyForSettings(v, s);
  const number = `${s.branding.quote_prefix}-TEST`;
  const orgName = s.general.company_name && s.general.company_name !== "Your Company" ? s.general.company_name : undefined;
  const contact = s.branding.support_contact || s.branding.email || undefined;
  const replyTo = s.branding.email && /.+@.+\..+/.test(s.branding.email) ? s.branding.email : undefined;

  const bodyHtml = `<p>This is a TEST quotation from ${escapeHtml(orgName ?? "your workspace")}. No customer was emailed.</p>`
    + `<table style="width:100%;border-collapse:collapse;font-size:14px;">`
    + `<tr><td>Quotation</td><td><strong>${escapeHtml(number)}</strong></td></tr>`
    + `<tr><td>Item (1 × ${escapeHtml(unit)})</td><td>${escapeHtml(money(unitPrice))} each</td></tr>`
    + `<tr><td>Subtotal</td><td>${escapeHtml(money(subtotal))}</td></tr>`
    + `<tr><td>CGST (${s.branding.tax_cgst}%)</td><td>${escapeHtml(money(cgst))}</td></tr>`
    + `<tr><td>SGST (${s.branding.tax_sgst}%)</td><td>${escapeHtml(money(sgst))}</td></tr>`
    + `<tr><td>IGST (${s.branding.tax_igst}%)</td><td>${escapeHtml(money(igst))}</td></tr>`
    + `<tr><td><strong>Total (${escapeHtml(s.general.default_currency)})</strong></td><td><strong>${escapeHtml(money(total))}</strong></td></tr>`
    + `</table>`;

  await sendMail({
    to,
    subject: `[TEST] Quotation ${number}`,
    html: brandedEmail(`Test quotation ${number}`, bodyHtml, undefined, {
      name: orgName,
      logoUrl: s.branding.logo_url || undefined,
      contact,
    }),
    ...(replyTo ? { replyTo } : {}),
    ...(orgName ? { fromName: orgName } : {}),
  });
  await logAutomation(orgId, { name: "test:send-quotation", status: "ok", detail: `test quotation email sent (test mode, settings recipient)` });
  return json(req, { ok: true, testMode: true });
});
