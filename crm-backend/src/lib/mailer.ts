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
});

export async function sendMail(input: { to: string; subject: string; html: string }): Promise<void> {
  const parsed = SendMailSchema.parse(input);
  const env = getEnv();
  await mailer().sendMail({
    from: `"${brand.mailFromName}" <${env.GMAIL_USER}>`,
    to: parsed.to,
    subject: parsed.subject,
    html: parsed.html,
  });
}

/** Branded HTML email shell — appName/logo/colors from brand config. */
export function brandedEmail(title: string, bodyHtml: string, link?: string): string {
  const safeLink = link ? `<p><a href="${escapeHtml(link)}" style="color:${brand.primaryColor}">Open in ${escapeHtml(brand.appName)}</a></p>` : "";
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f4f4f5;padding:24px;">
<div style="max-width:560px;margin:auto;background:#fff;border-radius:8px;overflow:hidden;">
<div style="background:${brand.primaryColor};color:#fff;padding:16px 24px;font-size:18px;font-weight:bold;">${escapeHtml(brand.appName)}</div>
<div style="padding:24px;"><h2 style="margin-top:0;">${escapeHtml(title)}</h2><div>${bodyHtml}</div>${safeLink}
<p style="color:#71717a;font-size:12px;">Need help? Contact ${escapeHtml(brand.supportEmail)}.</p></div>
</div></body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
