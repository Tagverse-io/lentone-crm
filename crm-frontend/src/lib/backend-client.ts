"use client";

// Calls the privileged backend (crm-backend). Attaches the Firebase ID token.
// Used for Google OAuth/Calendar, automations and notifications — never for secrets.

import { getAuthInstance } from "@/lib/firebase/config";
import { getEnv } from "./env";

export class BackendError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function idToken(): Promise<string> {
  const user = getAuthInstance().currentUser;
  if (!user) throw new Error("Not signed in");
  return user.getIdToken();
}

export async function backendFetch<T>(path: string, init?: RequestInit & { auth?: boolean }): Promise<T> {
  const env = getEnv();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (init?.auth !== false) headers.Authorization = `Bearer ${await idToken()}`;
  const res = await fetch(`${env.NEXT_PUBLIC_BACKEND_URL}${path}`, { ...init, headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) } });
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new BackendError(res.status, data.error ?? `Backend request failed (${res.status})`);
  return data as T;
}

export const backend = {
  // Automations (event-driven, idempotent)
  leadWon: (orgId: string, leadId: string) =>
    backendFetch<{ clientId: string; projectId: string | null }>(`/api/automations/lead-won`, { method: "POST", body: JSON.stringify({ orgId, leadId }) }),
  quotationAccepted: (orgId: string, quotationId: string) =>
    backendFetch<{ invoiceId: string; projectId: string | null }>(`/api/automations/quotation-accepted`, { method: "POST", body: JSON.stringify({ orgId, quotationId }) }),
  paymentReceived: (orgId: string, paymentId: string) =>
    backendFetch<{ ok: boolean }>(`/api/automations/payment-received`, { method: "POST", body: JSON.stringify({ orgId, paymentId }) }),
  // Google
  googleConnect: () => backendFetch<{ url: string }>(`/api/google/connect`),
  googleEvents: (orgId: string) => backendFetch<{ events: unknown[] }>(`/api/google/events?orgId=${encodeURIComponent(orgId)}`),
  googleSync: (orgId: string) => backendFetch<{ imported: number }>(`/api/google/sync`, { method: "POST", body: JSON.stringify({ orgId }) }),
  // Notifications
  sendNotification: (input: { orgId: string; uid: string; type: string; title: string; body: string; link?: string; email?: string }) =>
    backendFetch<{ ok: boolean }>(`/api/notifications/send`, { method: "POST", body: JSON.stringify(input) }),
};
