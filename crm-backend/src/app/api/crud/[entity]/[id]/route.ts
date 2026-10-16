import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { preflight, json, jsonError } from "@/lib/cors";
import { handle } from "@/lib/auth";
import { db, auth as adminAuth } from "@/lib/admin";
import { EntitySchema, crudGet, crudUpdate, crudDelete, type EntityName } from "@/lib/crud";

const PatchSchema = z.object({ orgId: z.string().min(1), data: z.record(z.string(), z.unknown()) });

export function OPTIONS(req: NextRequest): Promise<Response> {
  return Promise.resolve(preflight(req));
}

async function check(req: NextRequest, orgId: string, entity: EntityName, id: string): Promise<{ uid: string; role: string } | NextResponse> {
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
  if (entity === "users" && id !== user.uid && role !== "admin") {
    return jsonError(req, "Forbidden", 403);
  }
  return { uid: user.uid, role };
}

function isPrivileged(role: string): boolean {
  return role === "admin" || role === "owner";
}

async function parsedEntity(ctx: { params: Promise<{ entity: string; id: string }> }): Promise<{ entity: EntityName; id: string } | null> {
  const p = await ctx.params;
  const entity = EntitySchema.safeParse(p.entity);
  if (!entity.success || !p.id) return null;
  return { entity: entity.data, id: p.id };
}

// GET /api/crud/{entity}/{id}?orgId=...
export const GET = handle(async (req: NextRequest, ctx: { params: Promise<{ entity: string; id: string }> }) => {
  const parsed = await parsedEntity(ctx);
  if (!parsed) return jsonError(req, "Unknown entity or id", 400);
  const orgId = new URL(req.url).searchParams.get("orgId") ?? "";
  if (!orgId) return jsonError(req, "orgId query required", 400);
  const authed = await check(req, orgId, parsed.entity, parsed.id);
  if (authed instanceof NextResponse) return authed;
  const item = await crudGet(orgId, parsed.entity, parsed.id);
  if (!item) return jsonError(req, "Not found", 404);
  return json(req, { item });
});

// PUT /api/crud/{entity}/{id} { orgId, data }
export const PUT = handle(async (req: NextRequest, ctx: { params: Promise<{ entity: string; id: string }> }) => {
  const parsed = await parsedEntity(ctx);
  if (!parsed) return jsonError(req, "Unknown entity or id", 400);
  const body = PatchSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return jsonError(req, "Invalid body: orgId + data required", 400);
  const authed = await check(req, body.data.orgId, parsed.entity, parsed.id);
  if (authed instanceof NextResponse) return authed;
  // Credit notes are owner/admin only (edit).
  if (parsed.entity === "creditNotes" && !isPrivileged(authed.role)) {
    return jsonError(req, "Owner or admin only", 403);
  }
  const item = await crudUpdate(body.data.orgId, parsed.entity, parsed.id, body.data.data);
  if (!item) return jsonError(req, "Not found", 404);
  return json(req, { item });
});

// DELETE /api/crud/{entity}/{id}?orgId=...
export const DELETE = handle(async (req: NextRequest, ctx: { params: Promise<{ entity: string; id: string }> }) => {
  const parsed = await parsedEntity(ctx);
  if (!parsed) return jsonError(req, "Unknown entity or id", 400);
  const orgId = new URL(req.url).searchParams.get("orgId") ?? "";
  if (!orgId) return jsonError(req, "orgId query required", 400);
  const authed = await check(req, orgId, parsed.entity, parsed.id);
  if (authed instanceof NextResponse) return authed;
  // Deletes are owner/admin only, for every entity.
  if (!isPrivileged(authed.role)) {
    return jsonError(req, "Owner or admin only", 403);
  }
  const deleted = await crudDelete(orgId, parsed.entity, parsed.id);
  if (!deleted) return jsonError(req, "Not found", 404);
  return json(req, { ok: true });
});
