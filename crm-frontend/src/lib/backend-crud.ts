"use client";

// Typed CRUD client: writes go through the privileged backend REST API,
// reads stay realtime via the Firebase client SDK listener.
// Drop-in replacement for the previous direct-RTDB services.

import { ref, onValue, type Unsubscribe } from "firebase/database";
import { getDatabaseInstance } from "@/lib/firebase/config";
import { backendFetch } from "./backend-client";
import { cleanData, nowIso } from "./utils";
import type {
  Lead, Client, Contact, FollowUp, Quotation, Invoice, Payment,
  Project, Task, SocialAccount, Post, VideoProduction, CrmEvent, Expense, CreditNote,
} from "./types";

export interface CrudService<T extends { id: string; createdAt: string }> {
  list(orgId: string): Promise<T[]>;
  get(orgId: string, id: string): Promise<T | null>;
  create(orgId: string, data: Partial<Omit<T, "id">>): Promise<T>;
  update(orgId: string, id: string, patch: Partial<T>): Promise<void>;
  remove(orgId: string, id: string): Promise<void>;
  subscribe(orgId: string, cb: (items: T[]) => void, onError?: (e: Error) => void): Unsubscribe;
}

function toList<T>(val: unknown): T[] {
  if (!val || typeof val !== "object") return [];
  return Object.entries(val as Record<string, T>)
    .map(([id, v]) => ({ ...(v as object), id }) as T)
    .sort((a, b) => String((b as Record<string, unknown>).createdAt ?? (b as Record<string, unknown>).created_at ?? "").localeCompare(String((a as Record<string, unknown>).createdAt ?? (a as Record<string, unknown>).createdAt ?? "")));
}

function createClient<T extends { id: string; createdAt: string }>(entity: string): CrudService<T> {
  return {
    async list(orgId: string): Promise<T[]> {
      const res = await backendFetch<{ items: T[] }>(`/api/crud/${entity}?orgId=${encodeURIComponent(orgId)}`);
      return res.items;
    },
    async get(orgId: string, id: string): Promise<T | null> {
      try {
        const res = await backendFetch<{ item: T }>(`/api/crud/${entity}/${id}?orgId=${encodeURIComponent(orgId)}`);
        return res.item;
      } catch {
        return null;
      }
    },
    async create(orgId: string, data): Promise<T> {
      const now = nowIso();
      const payload = cleanData({
        ...data,
        createdAt: (data as { createdAt?: string }).createdAt ?? (data as { created_at?: string }).created_at ?? now,
      } as Record<string, unknown>);
      const res = await backendFetch<{ item: T }>(`/api/crud/${entity}`, {
        method: "POST",
        body: JSON.stringify({ orgId, data: payload }),
      });
      return res.item;
    },
    async update(orgId: string, id: string, patch): Promise<void> {
      await backendFetch(`/api/crud/${entity}/${id}`, {
        method: "PUT",
        body: JSON.stringify({ orgId, data: cleanData({ ...(patch as object) } as Record<string, unknown>) }),
      });
    },
    async remove(orgId: string, id: string): Promise<void> {
      await backendFetch(`/api/crud/${entity}/${id}?orgId=${encodeURIComponent(orgId)}`, { method: "DELETE" });
    },
    subscribe(orgId: string, cb, onError): Unsubscribe {
      return onValue(
        ref(getDatabaseInstance(), `/orgs/${orgId}/${entity}`),
        (snap) => cb(toList<T>(snap.val())),
        (e) => onError?.(e instanceof Error ? e : new Error(String(e))),
      );
    },
  };
}

export const leadsService = createClient<Lead>("leads");
export const clientsService = createClient<Client>("clients");
export const contactsService = createClient<Contact>("contacts");
export const followUpsService = createClient<FollowUp>("followUps");
export const quotationsService = createClient<Quotation>("quotations");
export const invoicesService = createClient<Invoice>("invoices");
export const paymentsService = createClient<Payment>("payments");
export const projectsService = createClient<Project>("projects");
export const tasksService = createClient<Task>("tasks");
export const socialAccountsService = createClient<SocialAccount>("socialAccounts");
export const postsService = createClient<Post>("posts");
export const videosService = createClient<VideoProduction>("videoProductions");
export const eventsService = createClient<CrmEvent>("events");
export const expensesService = createClient<Expense>("expenses");
export const creditNotesService = createClient<CreditNote>("creditNotes");
