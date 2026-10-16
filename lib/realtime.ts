"use client";

import { onValue, type Unsubscribe } from "firebase/database";
import { ref } from "firebase/database";
import { getFirebaseDatabase } from "./firebase";
import type { Delivery, FieldTask } from "./db";

// Realtime transport abstraction. The web UI uses Firebase Realtime
// Database listeners (WebSockets) for live updates; the Expo app uses the
// HTTPS webhook (POST /api/app/events) plus an SSE stream
// (GET /api/app/stream) with polling fallback. Swap `realtime` for an
// Ably/Pusher implementation later without touching UI code.

export interface WorkerFeed {
  tasks: FieldTask[];
  deliveries: Delivery[];
}

export interface RealtimeTransport {
  /** Live worker task feed (Firebase onValue under the hood). */
  subscribeWorkerFeed(workerId: string, cb: (feed: WorkerFeed) => void): Unsubscribe;
  /** Live delivery list for the Delivery page. */
  subscribeDeliveries(cb: (deliveries: Delivery[]) => void): Unsubscribe;
  /** Live latest-location list for the Field Force page. */
  subscribeLatestLocations(
    cb: (rows: { workerId: string; mapsUrl: string; timestamp: string; workerName?: string }[]) => void,
  ): Unsubscribe;
}

function toList<T>(val: unknown): (T & { id: string })[] {
  if (!val || typeof val !== "object") return [];
  return Object.entries(val as Record<string, unknown>)
    .filter(([, v]) => v && typeof v === "object")
    .map(([id, v]) => ({ id, ...(v as object) }) as T & { id: string });
}

export const firebaseTransport: RealtimeTransport = {
  subscribeWorkerFeed(workerId, cb) {
    const db = getFirebaseDatabase();
    const tasksRef = ref(db, "tasks");
    const deliveriesRef = ref(db, "deliveries");
    let tasks: FieldTask[] = [];
    let deliveries: Delivery[] = [];
    const emit = () =>
      cb({
        tasks: tasks.filter((t) => t.workerId === workerId && t.status !== "Done"),
        deliveries: deliveries.filter((d) => d.workerId === workerId && d.status !== "Delivered"),
      });
    const offTasks = onValue(tasksRef, (s) => {
      tasks = toList<FieldTask>(s.val());
      emit();
    });
    const offDeliveries = onValue(deliveriesRef, (s) => {
      deliveries = toList<Delivery>(s.val());
      emit();
    });
    return () => {
      offTasks();
      offDeliveries();
    };
  },

  subscribeDeliveries(cb) {
    const db = getFirebaseDatabase();
    return onValue(ref(db, "deliveries"), (s) => cb(toList<Delivery>(s.val())));
  },

  subscribeLatestLocations(cb) {
    const db = getFirebaseDatabase();
    return onValue(ref(db, "locations"), (s) => {
      const val = s.val() as Record<string, { latest?: { mapsUrl: string; timestamp: string; workerName?: string } }> | null;
      if (!val) return cb([]);
      cb(
        Object.entries(val)
          .filter(([, v]) => v?.latest)
          .map(([workerId, v]) => ({ workerId, ...(v.latest as { mapsUrl: string; timestamp: string; workerName?: string }) })),
      );
    });
  },
};

/** Default transport (Firebase). Replace with Ably/Pusher later. */
export const realtime: RealtimeTransport = firebaseTransport;

// ----- Expo client helpers: SSE stream with 30s polling fallback -----

export interface StreamEvent {
  type: "tasks" | "deliveries" | "ping";
  at: string;
}

/**
 * Subscribe to GET /api/app/stream?workerId= via Server-Sent Events.
 * Auto-reconnects (native EventSource retry) and falls back to polling
 * GET /api/app/tasks?workerId= every 30s when SSE is unavailable.
 * Returns an unsubscribe function.
 */
export function subscribeWorkerStream(
  workerId: string,
  onFeed: (feed: WorkerFeed) => void,
  opts?: { pollMs?: number },
): () => void {
  const pollMs = opts?.pollMs ?? 30_000;
  let stopped = false;
  let es: EventSource | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const poll = async () => {
    if (stopped) return;
    try {
      const res = await fetch(`/api/app/tasks?workerId=${encodeURIComponent(workerId)}`, { cache: "no-store" });
      if (!res.ok) return;
      const feed = (await res.json()) as WorkerFeed;
      onFeed(feed);
    } catch {
      // Offline — next poll retries.
    }
  };

  try {
    es = new EventSource(`/api/app/stream?workerId=${encodeURIComponent(workerId)}`);
    es.onmessage = () => {
      void poll(); // stream pinged: refresh the feed
    };
    es.onerror = () => {
      // SSE dropped: rely on polling until the browser reconnects.
      if (!pollTimer) pollTimer = setInterval(poll, pollMs);
    };
    es.onopen = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      void poll();
    };
  } catch {
    pollTimer = setInterval(poll, pollMs);
  }
  // Always poll in the background so a silent SSE break still self-heals.
  if (!pollTimer) pollTimer = setInterval(poll, pollMs);
  void poll();

  return () => {
    stopped = true;
    es?.close();
    if (pollTimer) clearInterval(pollTimer);
  };
}
