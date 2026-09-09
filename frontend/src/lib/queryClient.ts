import { QueryClient, QueryFunction } from "@tanstack/react-query";

export async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    // Parse the standard error envelope ({ success:false, error:{ code, message } })
    // or legacy { error } / { message } shapes so callers surface a clean, friendly
    // message instead of a raw "<status>: <json blob>" string. 403s get an explicit
    // friendly forbidden message when the backend doesn't supply one. (PATCH 7 API-001)
    let body: any = null;
    try {
      body = await res.clone().json();
    } catch {
      body = null;
    }
    if (res.status === 403) {
      // Only use a real backend-supplied message; fall back to the friendly
      // forbidden message when the body has none (extractApiError returns its
      // generic "Request failed (...)" placeholder).
      const extracted = body ? extractApiError(body, res.status) : null;
      const msg =
        extracted && extracted !== `Request failed (${res.status})`
          ? extracted
          : "You don't have permission to perform this action.";
      throw new Error(msg);
    }
    if (body) {
      throw new Error(extractApiError(body, res.status));
    }
    const text = (await res.text().catch(() => "")) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

let unauthorizedHandled = false;
function handleUnauthorized() {
  try {
    const switchTime = sessionStorage.getItem("roleSwitchInProgress");
    if (switchTime) {
      const elapsed = Date.now() - parseInt(switchTime, 10);
      if (elapsed < 10000) {
        // Ignore 401 errors for 10 seconds after a role switch to prevent wiping the fresh token
        return;
      }
    }
    sessionStorage.removeItem("token");
  } catch {
    // ignore storage errors
  }
  if (!unauthorizedHandled) {
    unauthorizedHandled = true;
    if (typeof window !== "undefined") {
      window.location.href = "/auth";
    }
  }
}

function resetUnauthorizedFlag() {
  unauthorizedHandled = false;
}

export function getAuthHeader(): Record<string, string> {
  try {
    const token = sessionStorage.getItem("token");
    const actingRole = sessionStorage.getItem("userRole");
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (actingRole) headers["x-acting-role"] = actingRole;
    return headers;
  } catch {
    return {};
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {
    ...(data ? { "Content-Type": "application/json" } : {}),
    ...getAuthHeader(),
  };
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  if (res.status === 401) {
    handleUnauthorized();
  }

  if (res.ok) {
    resetUnauthorizedFlag();
  }

  // Do NOT call throwIfResNotOk here — callers need to read res.json() themselves.
  // throwIfResNotOk consumes the body via res.text(), making subsequent res.json() fail.
  return res;
}

// Extracts a human-readable error message from a parsed JSON body, supporting both
// the legacy string shape ({ error: "msg" }) and the Patch 5 envelope shape
// ({ error: { code, message } }). Falls back to a status-based message.
export function extractApiError(body: any, status: number): string {
  if (body && typeof body.error === "string") return body.error;
  if (body && body.error && typeof body.error.message === "string") return body.error.message;
  if (body && typeof body.message === "string") return body.message;
  return `Request failed (${status})`;
}

// Performs an apiRequest, parses the JSON body, and THROWS (with the backend's
// error message) on any non-2xx response so React Query's onError fires correctly.
// Use this for mutations that must surface backend validation/authz failures.
export async function mutationRequest<T = any>(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<T> {
  const res = await apiRequest(method, url, data);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(extractApiError(body, res.status));
  }
  return body as T;
}

// Performs an apiRequest and parses JSON, throwing on a non-2xx response so that
// React Query's isError / mutation onError fire correctly. Use this instead of
// calling res.json() directly when you need errors surfaced honestly.
export async function apiRequestJson<T = any>(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<T> {
  const res = await apiRequest(method, url, data);
  if (!res.ok) {
    await throwIfResNotOk(res);
  }
  return (await res.json()) as T;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
    async ({ queryKey }) => {
      const res = await fetch(queryKey.join("/") as string, {
        headers: getAuthHeader(),
        credentials: "include",
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      if (res.status === 401) {
        handleUnauthorized();
      }

      if (res.ok) {
        resetUnauthorizedFlag();
      }

      await throwIfResNotOk(res);
      return await res.json();
    };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      // Auto-refresh: poll every 30s + refetch when user returns to tab
      // Dynamic interval: stop polling if the last request failed (circuit breaker protection)
      refetchInterval: (query: any) => (query.state.status === "error" ? false : 30_000),
      refetchOnWindowFocus: true,       // re-fetch when user switches back to tab
      refetchIntervalInBackground: false, // stop polling when tab is hidden (saves bandwidth)
      staleTime: 0,                     // always treat cached data as stale → immediate refetch on mount
      gcTime: 5 * 60 * 1000,           // keep unused cache for 5 minutes
      // Exponential backoff for retries to avoid overwhelming backend/DB
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 3 ** attemptIndex, 60000),
    },
    mutations: {
      retry: false,
    },
  },
});
