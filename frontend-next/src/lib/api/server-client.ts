import { getBackendUrl } from "@/config/env";
import { throwIfResNotOk } from "./errors";

export type ServerFetchOptions = RequestInit & {
  json?: unknown;
  /**
   * Raw Cookie header value from the incoming browser request.
   * Forward only to the trusted Express origin — never log this value.
   */
  forwardCookie?: string;
};

/**
 * Server-side fetch to Express. Uses absolute BACKEND_URL, not browser-relative `/api`.
 *
 * Phase 1: foundation only. Use when a future Server Component needs API data and
 * the team has approved cookie forwarding for that route.
 */
export async function serverApiFetch<T = unknown>(
  apiPath: string,
  options: ServerFetchOptions = {},
): Promise<T> {
  const base = getBackendUrl();
  const path = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
  const url = `${base}${path}`;

  const { json, forwardCookie, headers, ...init } = options;

  const res = await fetch(url, {
    ...init,
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(forwardCookie ? { cookie: forwardCookie } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : init.body,
    cache: "no-store",
  });

  await throwIfResNotOk(res);

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}
