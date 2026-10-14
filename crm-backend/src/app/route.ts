import { NextResponse } from "next/server";

export function GET(): NextResponse {
  return NextResponse.json({ ok: true, service: "crm-backend", docs: "/api/health" });
}
