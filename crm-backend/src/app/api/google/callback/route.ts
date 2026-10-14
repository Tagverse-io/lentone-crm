import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { exchangeCode, verifyState } from "@/lib/google";
import { logAutomation } from "@/lib/log";

// GET /api/google/callback?code=...&state=... — no ID token here (browser redirect),
// CSRF-protected by the signed state param. Redirects back to the frontend.
export async function GET(req: NextRequest): Promise<NextResponse> {
  const env = getEnv();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const done = (params: string): NextResponse => NextResponse.redirect(`${env.FRONTEND_URL}/calendar?google=${params}`);

  if (error) return done("error=denied");
  if (!code || !state) return done("error=missing");
  try {
    const uid = verifyState(state);
    await exchangeCode(code, uid);
    await logAutomation("default", { name: "google:connect", status: "ok", detail: "Google account connected" });
    return done("connected=1");
  } catch {
    await logAutomation("default", { name: "google:connect", status: "error", detail: "OAuth callback failed" });
    return done("error=failed");
  }
}
