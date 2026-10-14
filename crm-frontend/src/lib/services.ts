"use client";

// Typed RTDB CRUD service factory — one per module, org-scoped.
// All functions strip undefined values, stamp createdAt/updatedAt, and
// throw typed errors so pages can render loading/error/empty states.

import {
  ref,
  get,
  set,
  update,
  push,
  remove,
  onValue,
  type Unsubscribe,
} from "firebase/database";
import { firebaseDb } from "./firebase";
import { cleanData, nowIso } from "./utils";
import type { EntityKey } from "./types";

export function orgPath(orgId: string, entity: EntityKey, id?: string): string {
  return id ? `/orgs/${orgId}/${entity}/${id}` : `/orgs/${orgId}/${entity}`;
}

export interface CrudService<T extends { id: string; createdAt: string }> {
  list(orgId: string): Promise<T[]>;
  get(orgId: string, id: string): Promise<T | null>;
  create(orgId: string, data: Partial<Omit<T, "id">>): Promise<T>;
  update(orgId: string, id: string, patch: Partial<T>): Promise<void>;
  remove(orgId: string, id: string): Promise<void>;
  subscribe(orgId: string, cb: (items: T[]) => void, onError?: (e: Error) => void): Unsubscribe;
}

function snapshotToList<T>(val: unknown): T[] {
  if (!val || typeof val !== "object") return [];
  return Object.entries(val as Record<string, T>).map(([id, v]) => ({ ...(v as object), id }) as T);
}

export function createService<T extends { id: string; createdAt: string }>(entity: EntityKey): CrudService<T> {
  return {
    async list(orgId: string): Promise<T[]> {
      const snap = await get(ref(firebaseDb(), orgPath(orgId, entity)));
      return snapshotToList<T>(snap.val()).sort((a, b) =>
        String((b as Record<string, unknown>).createdAt ?? "").localeCompare(String((a as Record<string, unknown>).createdAt ?? "")),
      );
    },
    async get(orgId: string, id: string): Promise<T | null> {
      const snap = await get(ref(firebaseDb(), orgPath(orgId, entity, id)));
      const v = snap.val();
      return v ? ({ ...(v as object), id }) as T : null;
    },
    async create(orgId: string, data): Promise<T> {
      const db = firebaseDb();
      const newRef = push(ref(db, orgPath(orgId, entity)));
      const id = newRef.key as string;
      const now = nowIso();
      const record = cleanData({ ...data, id, createdAt: (data as { createdAt?: string }).createdAt ?? now, updatedAt: now } as unknown as T);
      await set(newRef, record);
      return record;
    },
    async update(orgId: string, id: string, patch): Promise<void> {
      await update(ref(firebaseDb(), orgPath(orgId, entity, id)), cleanData({ ...patch, id, updatedAt: nowIso() } as Partial<T>));
    },
    async remove(orgId: string, id: string): Promise<void> {
      await remove(ref(firebaseDb(), orgPath(orgId, entity, id)));
    },
    subscribe(orgId: string, cb, onError): Unsubscribe {
      return onValue(
        ref(firebaseDb(), orgPath(orgId, entity)),
        (snap) => cb(snapshotToList<T>(snap.val())),
        (e) => onError?.(e instanceof Error ? e : new Error(String(e))),
      );
    },
  };
}

// Per-module typed services (import these in pages).
import type {
  Lead, Client, Contact, FollowUp, Quotation, Invoice, Payment,
  Project, Task, SocialAccount, Post, VideoProduction, CrmEvent,
  AppNotification, OrgUser, AutomationLogEntry,
} from "./types";

export const leadsService = createService<Lead>("leads");
export const clientsService = createService<Client>("clients");
export const contactsService = createService<Contact>("contacts");
export const followUpsService = createService<FollowUp>("followUps");
export const quotationsService = createService<Quotation>("quotations");
export const invoicesService = createService<Invoice>("invoices");
export const paymentsService = createService<Payment>("payments");
export const projectsService = createService<Project>("projects");
export const tasksService = createService<Task>("tasks");
export const socialAccountsService = createService<SocialAccount>("socialAccounts");
export const postsService = createService<Post>("posts");
export const videosService = createService<VideoProduction>("videoProductions");
export const eventsService = createService<CrmEvent>("events");
export const notificationsService = createService<AppNotification>("notifications");
export const usersService = createService<OrgUser>("users");
export const automationsLogService = createService<AutomationLogEntry>("automationsLog");
