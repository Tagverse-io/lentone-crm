"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ref, onValue, update } from "firebase/database";
import { Bell, Moon, Sun, LogOut } from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth-context";
import { firebaseDb } from "@/lib/firebase";
import type { AppNotification } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export function Header(): JSX.Element {
  const { fbUser, orgUser, orgId, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!fbUser) return;
    const r = ref(firebaseDb(), `/orgs/${orgId}/notifications/${fbUser.uid}`);
    const unsub = onValue(r, (snap) => {
      const v = snap.val() as Record<string, AppNotification> | null;
      const list = v ? Object.entries(v).map(([id, n]) => ({ ...n, id })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];
      setItems(list.slice(0, 20));
    });
    return unsub;
  }, [fbUser, orgId]);

  const unread = items.filter((i) => !i.read).length;

  const markRead = async (id: string): Promise<void> => {
    if (!fbUser) return;
    await update(ref(firebaseDb(), `/orgs/${orgId}/notifications/${fbUser.uid}/${id}`), { read: true });
  };
  const markAll = async (): Promise<void> => {
    if (!fbUser) return;
    const patch: Record<string, unknown> = {};
    for (const n of items.filter((i) => !i.read)) patch[`${n.id}/read`] = true;
    if (Object.keys(patch).length > 0) await update(ref(firebaseDb(), `/orgs/${orgId}/notifications/${fbUser.uid}`), patch);
  };

  return (
    <header className="flex items-center justify-between gap-2 border-b bg-card px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{orgUser?.displayName ?? fbUser?.email ?? ""}</p>
        <p className="text-xs text-muted-foreground">{orgUser?.role ?? ""} · {orgId}</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          className="rounded-md border p-2 hover:bg-accent"
          aria-label="Toggle theme"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <div className="relative">
          <button className="relative rounded-md border p-2 hover:bg-accent" aria-label={`Notifications, ${unread} unread`} onClick={() => setOpen((o) => !o)}>
            <Bell className="h-4 w-4" />
            {unread > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            ) : null}
          </button>
          {open ? (
            <div className="absolute right-0 z-50 mt-2 max-h-96 w-80 overflow-y-auto rounded-lg border bg-background shadow-lg">
              <div className="flex items-center justify-between border-b p-3">
                <p className="text-sm font-semibold">Notifications</p>
                <button className="text-xs text-primary hover:underline" onClick={markAll}>Mark all read</button>
              </div>
              {items.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No notifications yet.</p>
              ) : (
                items.map((n) => (
                  <div key={n.id} className={`border-b p-3 text-sm ${n.read ? "opacity-70" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{n.title}</p>
                      {!n.read ? <button className="text-xs text-primary hover:underline" onClick={() => markRead(n.id)}>Read</button> : null}
                    </div>
                    <p className="text-muted-foreground">{n.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</p>
                    {n.link ? <Link href={n.link} className="text-xs text-primary hover:underline" onClick={() => setOpen(false)}>Open</Link> : null}
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>
        <button className="rounded-md border p-2 hover:bg-accent" aria-label="Sign out" onClick={signOut}>
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
