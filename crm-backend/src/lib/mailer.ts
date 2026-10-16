import nodemailer, { type Transporter } from "nodemailer";
import { z } from "zod";
import { getEnv } from "./env";
import { brand } from "@/brand.config";

let transporter: Transporter | null = null;

/** Singleton Gmail SMTP transport. Never log credentials or bodies. */
export function mailer(): Transporter {
  if (transporter) return transporter;
  const env = getEnv();
  transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD },
  });
  return transporter;
}

const SendMailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  html: z.string().min(1).max(100_000),
  replyTo: z.string().email().optional(),
  fromName: z.string().min(1).max(100).optional(),
});

export async function sendMail(input: { to: string; subject: string; html: string; replyTo?: string; fromName?: string }): Promise<void> {
  const parsed = SendMailSchema.parse(input);
  const env = getEnv();
  const fromName = parsed.fromName ?? brand.mailFromName;
  await mailer().sendMail({
    from: `"${fromName.replace(/"/g, "")}" <${env.GMAIL_USER}>`,
    to: parsed.to,
    subject: parsed.subject,
    html: parsed.html,
    ...(parsed.replyTo ? { replyTo: parsed.replyTo } : {}),
  });
}

/**
 * Branded HTML email shell — appName/colors from brand config, company
 * identity (name/logo/contact) from org Settings. logoUrl may be an
 * absolute URL or a base64 data URL (both render in modern clients);
 * missing logos degrade to the name banner.
 */
export function brandedEmail(
  title: string,
  bodyHtml: string,
  link?: string,
  org?: { name?: string; logoUrl?: string; contact?: string },
): string {
  const safeLink = link ? `<p><a href="${escapeHtml(link)}" style="color:${brand.primaryColor}">Open in ${escapeHtml(brand.appName)}</a></p>` : "";
  const name = org?.name || brand.appName;
  const logo = org?.logoUrl
    ? `<img src="${org.logoUrl}" alt="${escapeHtml(name)}" style="max-height:44px;max-width:200px;object-fit:contain;" />`
    : "";
  const contact = org?.contact ? `<p style="color:#71717a;font-size:12px;">${escapeHtml(org.contact)}</p>` : "";
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f4f4f5;padding:24px;">
<div style="max-width:560px;margin:auto;background:#fff;border-radius:8px;overflow:hidden;">
<div style="background:${brand.primaryColor};color:#fff;padding:16px 24px;font-size:18px;font-weight:bold;">${logo}${logo ? "<br/>" : ""}${escapeHtml(name)}</div>
<div style="padding:24px;"><h2 style="margin-top:0;">${escapeHtml(title)}</h2><div>${bodyHtml}</div>${safeLink}
<p style="color:#71717a;font-size:12px;">Need help? Contact ${escapeHtml(brand.supportEmail)}.</p>${contact}</div>
</div></body></html>`;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
