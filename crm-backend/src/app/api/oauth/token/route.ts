import { NextRequest, NextResponse } from "next/server";
import { consumeCode, issueTokens, oauthClientSecret, rotateRefresh } from "@/lib/oauth";

// POST /api/oauth/token — application/x-www-form-urlencoded.
// grant_type=authorization_code | refresh_token. Public clients allowed
// unless MCP_OAUTH_CLIENT_SECRET is set (then client_secret must match).
export async function POST(req: NextRequest): Promise<NextResponse> {
  let form: URLSearchParams;
  try {
    form = new URLSearchParams(await req.text());
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const requiredSecret = oauthClientSecret();
  if (requiredSecret) {
    const given = form.get("client_secret") ?? "";
    if (given !== requiredSecret) {
      return NextResponse.json({ error: "invalid_client" }, { status: 401 });
    }
  }
  const grant = form.get("grant_type");
  try {
    if (grant === "authorization_code") {
      const code = form.get("code") ?? "";
      const redirectUri = form.get("redirect_uri") ?? "";
      if (!code || !redirectUri) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
      const rec = await consumeCode(code, redirectUri);
      const t = await issueTokens(rec.uid, rec.orgId, rec.scope);
      return NextResponse.json({
        access_token: t.access, token_type: "Bearer", expires_in: t.expiresIn,
        refresh_token: t.refresh, scope: rec.scope,
      });
    }
    if (grant === "refresh_token") {
      const refresh = form.get("refresh_token") ?? "";
      if (!refresh) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
      const t = await rotateRefresh(refresh);
      return NextResponse.json({
        access_token: t.access, token_type: "Bearer", expires_in: t.expiresIn,
        refresh_token: t.refresh,
      });
    }
    return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "failed";
    const code = msg === "invalid_grant" ? "invalid_grant" : "server_error";
    return NextResponse.json({ error: code }, { status: msg === "invalid_grant" ? 400 : 500 });
  }
}
