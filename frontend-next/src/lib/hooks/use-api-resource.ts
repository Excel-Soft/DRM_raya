"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, type BrowserFetchOptions } from "@/lib/api/browser-client";
import { ApiError } from "@/lib/api/errors";

export type ApiResourceState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  forbidden: boolean;
  refetch: () => void;
};

/**
 * Lightweight read-only fetch hook (React Query deferred until multiple modules need cache/invalidation).
 * Uses existing apiFetch for auth headers and 401/403 handling.
 */
export function useApiResource<T>(
  path: string | null,
  options?: BrowserFetchOptions & { enabled?: boolean },
): ApiResourceState<T> {
  const active = options?.enabled !== false && path !== null;
  const [data, setData] = useState<T | null>(null);
  const [pending, setPending] = useState(active);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [tick, setTick] = useState(0);
  const loading = active && pending;

  const refetch = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!active || !path) return;

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset fetch state when path/tick changes
    setPending(true);
    setError(null);
    setForbidden(false);

    void (async () => {
      try {
        const json = await apiFetch<T>(path, options);
        if (!cancelled) setData(json);
      } catch (e) {
        if (cancelled) return;
        setData(null);
        if (e instanceof ApiError && e.status === 403) {
          setForbidden(true);
          return;
        }
        setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Network error");
      } finally {
        if (!cancelled) setPending(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch via tick; path/options identity is caller responsibility
  }, [path, active, tick]);

  return { data, loading, error, forbidden, refetch };
}
