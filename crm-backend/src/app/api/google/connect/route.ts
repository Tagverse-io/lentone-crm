import { NextRequest } from "next/server";
import { preflight, json } from "@/lib/cors";
import { handle, requireUser } from "@/lib/auth";
import { connectUrl } from "@/lib/google";

export function OPTIONS(req: NextRequest): Promise<Response> {
  return Promise.resolve(preflight(req));
}

// GET /api/google/connect → { url } (frontend redirects the user there)
export const GET = handle(async (req: NextRequest) => {
  const user = await requireUser(req);
  return json(req, { url: connectUrl(user.uid) });
});
