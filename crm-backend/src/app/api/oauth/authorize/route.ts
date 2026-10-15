import { NextRequest, NextResponse } from "next/server";
import { brand } from "@/brand.config";
import { issueCode, oauthOrg, orgAdminUid } from "@/lib/oauth";

// GET /api/oauth/authorize?response_type=code&client_id=...&redirect_uri=...&scope=...&state=...
// Renders a consent page; submitting Approve (?approve=1) issues a code and
// redirects back. Binds to the org's first admin (single-tenant).
export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const q = url.searchParams;
  const clientId = q.get("client_id") ?? "mcp-client";
  const redirectUri = q.get("redirect_uri") ?? "";
  const scope = q.get("scope") ?? "crm";
  const state = q.get("state") ?? "";
  const orgId = q.get("org") ?? oauthOrg();

  const fail = (msg: string): NextResponse =>
    new NextResponse(`<h1>${brand.appName} — OAuth</h1><p>${msg}</p>`, {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });

  if (!redirectUri) return fail("Missing redirect_uri.");
  let parsedRedirect: URL;
  try {
    parsedRedirect = new URL(redirectUri);
  } catch {
    return fail("Invalid redirect_uri.");
  }
  if (parsedRedirect.protocol !== "https:" && parsedRedirect.hostname !== "localhost") {
    return fail("redirect_uri must be https (or localhost).");
  }

  if (q.get("approve") === "1") {
    const uid = await orgAdminUid(orgId);
    if (!uid) {
      return fail("No admin user in this org yet — sign in to the CRM first, then retry.");
    }
    const code = await issueCode(uid, orgId, redirectUri, scope);
    const back = new URL(redirectUri);
    back.searchParams.set("code", code);
    if (state) back.searchParams.set("state", state);
    return NextResponse.redirect(back);
  }

  if (q.get("deny") === "1") {
    const back = new URL(redirectUri);
    back.searchParams.set("error", "access_denied");
    if (state) back.searchParams.set("state", state);
    return NextResponse.redirect(back);
  }

  const self = new URL(req.url);
  self.searchParams.set("approve", "1");
  const deny = new URL(req.url);
  deny.searchParams.set("deny", "1");
  const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(brand.appName)} — Connect</title></head>` +
      `<body style="font-family:Arial,sans-serif;background:#f4f4f5;padding:32px"><div style="max-width:480px;margin:auto;background:#fff;border-radius:12px;padding:28px">` +
      `<h2 style="margin-top:0">${esc(brand.appName)}</h2>` +
      `<p><strong>${esc(clientId)}</strong> is requesting access to your CRM (leads, invoices, projects, calendar, notifications).</p>` +
      `<p style="color:#666;font-size:14px">Scope: ${esc(scope)} · Org: ${esc(orgId)}</p>` +
      `<p style="color:#991b1b;font-size:13px">Only approve for clients you trust — approval grants full access.</p>` +
      `<p><a href="${self.toString()}" style="display:inline-block;background:${brand.primaryColor};color:#fff;padding:10px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Approve</a> ` +
      `<a href="${deny.toString()}" style="color:#666;font-size:14px">Deny</a></p>` +
      `</div></body></html>`,
    { headers: { "Content-Type": "text/html" } },
  );
}
