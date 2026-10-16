"use client";

import useSWR, { type SWRConfiguration } from "swr";
import { getCollection, getSettings, type AppSettings, type Delivery, type FieldTask } from "./db";

// Polling-only realtime transport (Vercel serverless has no persistent
// WebSockets; no onValue listeners, no SSE/EventSource anywhere in the UI).
// Swap `transport` for an Ably/Pusher implementation later without touching UI.
//
// Intervals: hot lists (Dashboard, Field Force, Delivery, Tasks) poll every
// 15s; everything else every 60s. Polling pauses when the tab is hidden
// (refreshWhenHidden: false) and every view has a manual refresh button.

export const POLL_FAST_MS = 15_000;
export const POLL_SLOW_MS = 60_000;
/** Expo app poll cadence for GET /api/app/tasks?workerId=. */
export const POLL_APP_MS = 30_000;

export interface WorkerFeed {
  tasks: FieldTask[];
  deliveries: Delivery[];
}

export interface PollingTransport {
  /** One-shot fetch of a worker's open tasks + deliveries. */
  fetchWorkerFeed(workerId: string): Promise<WorkerFeed>;
  /** SWR-backed polling hook. Pauses when the tab is hidden. */
  usePolling<T>(key: string | null, fetcher: () => Promise<T>, intervalMs: number): PollingState<T>;
  /** App settings with slow polling. */
  useSettings(): PollingState<AppSettings>;
}

export interface PollingState<T> {
  data: T | undefined;
  error: Error | undefined;
  isLoading: boolean;
  refresh: () => Promise<T | undefined>;
}

async function fetchWorkerFeed(workerId: string): Promise<WorkerFeed> {
  const [tasks, deliveries] = await Promise.all([
    getCollection<FieldTask>("tasks"),
    getCollection<Delivery>("deliveries"),
  ]);
  return {
    tasks: tasks.filter((t) => t.workerId === workerId && t.status !== "Done"),
    deliveries: deliveries.filter((d) => d.workerId === workerId && d.status !== "Delivered"),
  };
}

function usePolling<T>(key: string | null, fetcher: () => Promise<T>, intervalMs: number): PollingState<T> {
  const cfg: SWRConfiguration = {
    refreshInterval: intervalMs,
    revalidateOnFocus: true,
    refreshWhenHidden: false,
    dedupingInterval: Math.min(intervalMs, 5_000),
    keepPreviousData: true,
  };
  const { data, error, isLoading, mutate } = useSWR<T, Error>(key, fetcher, cfg);
  return {
    data,
    error: error as Error | undefined,
    isLoading,
    refresh: () => mutate(),
  };
}

function useSettings(): PollingState<AppSettings> {
  return usePolling<AppSettings>("settings", getSettings, POLL_SLOW_MS);
}

/** Default transport (polling). Replace with Ably/Pusher later. */
export const transport: PollingTransport = { fetchWorkerFeed, usePolling, useSettings };

/** Backwards-compatible named exports used across pages. */
export const realtime = transport;
export const usePollingQuery = usePolling;
export const useAppSettings = useSettings;
export { fetchWorkerFeed, usePolling, useSettings };
