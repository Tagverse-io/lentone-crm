import { NextRequest } from "next/server";
import { preflight, json } from "@/lib/cors";
import { handle } from "@/lib/auth";

export function OPTIONS(req: NextRequest): Promise<Response> {
  return Promise.resolve(preflight(req));
}

export const GET = handle(async (req: NextRequest) => json(req, { ok: true, service: "crm-backend" }));
