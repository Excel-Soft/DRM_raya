import { throwIfResNotOk } from "./errors";
import { getAuthHeaders } from "@/lib/auth/session";

export type BrowserFetchOptions = Omit<RequestInit, "credentials"> & {
  /** JSON body; sets Content-Type when provided. */
  json?: unknown;
};

/**
 * Browser API client for Express `/api/*`.
 *
 * Uses same-origin `/api/...` paths so Next rewrites (dev) or Nginx (prod) forward
 * to Express. Session cookies use `credentials: "include"` to match legacy Vite app.
 *
 * Express remains the authentication and authorization authority.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: BrowserFetchOptions = {},
): Promise<T> {
  const { json, headers, ...init } = options;
  const url = path.startsWith("/") ? path : `/${path}`;

  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...getAuthHeaders(),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : init.body,
  });

  await throwIfResNotOk(res);

  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await res.json()) as T;
  }

  return (await res.text()) as T;
}

/** Public health endpoint (registered before JWT middleware on Express). */
export type DbHealthResponse = {
  ok: boolean;
  db?: string;
  time?: string;
  message?: string;
};

export function fetchDbHealth(): Promise<DbHealthResponse> {
  return apiFetch<DbHealthResponse>("/api/health/db");
}
