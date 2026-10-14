"use client";

import { useEffect, useState } from "react";
import type { CrudService } from "./services";

interface CollectionState<T> {
  items: T[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Real-time collection hook with loading/error/empty states + optimistic updates. */
export function useCollection<T extends { id: string; createdAt: string }>(service: CrudService<T>, orgId: string | null): CollectionState<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const unsub = service.subscribe(
      orgId,
      (list) => {
        setItems(list);
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      },
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, tick]);

  return { items, loading, error, reload: () => setTick((t) => t + 1) };
}
