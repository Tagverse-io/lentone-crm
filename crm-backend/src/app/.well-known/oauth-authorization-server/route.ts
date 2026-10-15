import { NextResponse } from "next/server";

// RFC 8414 discovery — lets ChatGPT auto-fill Authorization/Token URLs.
export function GET(req: Request): NextResponse {
  const origin = new URL(req.url).origin;
  return NextResponse.json({
    issuer: origin,
    authorization_endpoint: `${origin}/api/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
    scopes_supported: ["crm"],
    code_challenge_methods_supported: ["S256", "plain"],
  });
}
