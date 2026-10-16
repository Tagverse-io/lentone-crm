import { NextRequest } from "next/server";
import { z } from "zod";
import { preflight, json, jsonError } from "@/lib/cors";
import { handle, requireUser, requireOrgMember } from "@/lib/auth";
import { nextNumber, type NumberKind } from "@/lib/numbering";

const Body = z.object({ orgId: z.string().min(1), kind: z.enum(["invoice", "quote", "creditNote"]) });

export function OPTIONS(req: NextRequest): Promise<Response> {
  return Promise.resolve(preflight(req));
}

// POST /api/numbering/next { orgId, kind } — reserve the next atomic
// document number from Settings prefix/format.
export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser(req);
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(req, "Invalid body: orgId, kind required", 400);
  await requireOrgMember(parsed.data.orgId, user.uid);
  const number = await nextNumber(parsed.data.orgId, parsed.data.kind as NumberKind);
  return json(req, { number });
});
