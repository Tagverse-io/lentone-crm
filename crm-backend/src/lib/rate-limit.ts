import { NextResponse } from "next/server";

// Tiny in-memory rate limiter for low-volume test routes (per instance).
// Not a security boundary — the owner/admin check is.
const hits = new Map<string, number[]>();

export function rateLimit(key: string, max: number, windowMs: number): void {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    throw NextResponse.json({ error: "Rate limit exceeded, try again later" }, { status: 429 });
  }
  arr.push(now);
  hits.set(key, arr);
}
