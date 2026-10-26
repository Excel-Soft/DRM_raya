"use client";

import { QueryClient, type QueryFunction } from "@tanstack/react-query";
import { throwIfResNotOk, extractApiErrorMessage } from "@/lib/api/errors";
import { getAuthHeaders } from "@/lib/auth/session";

/** Legacy alias used by ported DRM views. */
export function getAuthHeader(): Record<string, string> {
  return getAuthHeaders();
}

export function extractApiError(body: unknown, status: number): string {
  return extractApiErrorMessage(body, status);
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
): Promise<Response> {
  const isFormData = typeof FormData !== "undefined" && data instanceof FormData;
  const headers: Record<string, string> = {
    ...(data && !isFormData ? { "Content-Type": "application/json" } : {}),
    ...getAuthHeaders(),
  };
  const res = await fetch(url, {
    method,
    headers,
    body: isFormData ? (data as FormData) : data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/auth";
  }

  return res;
}

export async function mutationRequest<T = unknown>(
  method: string,
  url: string,
  data?: unknown,
): Promise<T> {
  const res = await apiRequest(method, url, data);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(extractApiError(body, res.status));
  }
  return body as T;
}

export async function apiRequestJson<T = unknown>(
  method: string,
  url: string,
  data?: unknown,
): Promise<T> {
  const res = await apiRequest(method, url, data);
  if (!res.ok) {
    await throwIfResNotOk(res);
  }
  return (await res.json()) as T;
}

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      headers: getAuthHeaders(),
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    if (res.status === 401 && typeof window !== "undefined") {
      window.location.href = "/auth";
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      refetchIntervalInBackground: false,
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 3 ** attemptIndex, 60000),
    },
    mutations: {
      retry: false,
    },
  },
});
