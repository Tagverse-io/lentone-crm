import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { preflight, json, jsonError } from "@/lib/cors";
import { handle } from "@/lib/auth";
import { db, auth as adminAuth } from "@/lib/admin";
import { EntitySchema, crudList, crudCreate, type EntityName } from "@/lib/crud";

const BodySchema = z.object({ orgId: z.string().min(1), data: z.record(z.string(), z.unknown()) });

export function OPTIONS(req: NextRequest): Promise<Response> {
  return Promise.resolve(preflight(req));
}

async function check(req: NextRequest, orgId: string, entity: EntityName, id?: string): Promise<{ uid: string; role: string } | NextResponse> {
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return jsonError(req, "Missing Authorization Bearer token", 401);
  let user;
  try {
    user = await adminAuth().verifyIdToken(header.slice(7).trim());
  } catch {
    return jsonError(req, "Invalid or expired token", 401);
  }
  const roleSnap = await db().ref(`/orgs/${orgId}/users/${user.uid}/role`).get();
  if (!roleSnap.exists()) return jsonError(req, "Not a member of this org", 403);
  const role = roleSnap.val() as string;
  // Users entity: members may only touch their own record.
  if (entity === "users" && id && id !== user.uid && role !== "admin") {
    return jsonError(req, "Forbidden", 403);
  }
  return { uid: user.uid, role };
}

function isPrivileged(role: string): boolean {
  return role === "admin" || role === "owner";
}

// GET /api/crud/{entity}?orgId=... — list all records.
export const GET = handle(async (req: NextRequest, ctx: { params: Promise<{ entity: string }> }) => {
  const entity = EntitySchema.safeParse((await ctx.params).entity);
  if (!entity.success) return jsonError(req, "Unknown entity", 400);
  const orgId = new URL(req.url).searchParams.get("orgId") ?? "";
  if (!orgId) return jsonError(req, "orgId query required", 400);
  const authed = await check(req, orgId, entity.data);
  if (authed instanceof NextResponse) return authed;
  return json(req, { items: await crudList(orgId, entity.data) });
});

// POST /api/crud/{entity} { orgId, data } — create.
export const POST = handle(async (req: NextRequest, ctx: { params: Promise<{ entity: string }> }) => {
  const entity = EntitySchema.safeParse((await ctx.params).entity);
  if (!entity.success) return jsonError(req, "Unknown entity", 400);
  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(req, "Invalid body: orgId + data required", 400);
  const authed = await check(req, parsed.data.orgId, entity.data);
  if (authed instanceof NextResponse) return authed;
  // Credit notes are owner/admin only (issue).
  if (entity.data === "creditNotes" && !isPrivileged(authed.role)) {
    return jsonError(req, "Owner or admin only", 403);
  }
  try {
    return json(req, { item: await crudCreate(parsed.data.orgId, entity.data, parsed.data.data) }, 201);
  } catch (e) {
    return jsonError(req, e instanceof Error ? e.message : "Create failed", 400);
  }
});
