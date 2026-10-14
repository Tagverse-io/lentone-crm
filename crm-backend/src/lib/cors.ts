import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "./env";

/** CORS: backend allows only FRONTEND_URL. Handles OPTIONS preflight. */
export function corsHeaders(req: NextRequest): Headers {
  const env = getEnv();
  const origin = req.headers.get("origin") ?? "";
  const allowed = origin === env.FRONTEND_URL ? origin : env.FRONTEND_URL;
  const h = new Headers();
  h.set("Access-Control-Allow-Origin", allowed);
  h.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  h.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  h.set("Access-Control-Max-Age", "86400");
  return h;
}

export function withCors(req: NextRequest, res: NextResponse): NextResponse {
  const h = corsHeaders(req);
  h.forEach((v, k) => res.headers.set(k, v));
  return res;
}

export function preflight(req: NextRequest): NextResponse {
  return withCors(req, new NextResponse(null, { status: 204 }));
}

export function json(req: NextRequest, data: unknown, status = 200): NextResponse {
  return withCors(req, NextResponse.json(data, { status }));
}

export function jsonError(req: NextRequest, message: string, status = 400): NextResponse {
  return json(req, { error: message }, status);
}
