import { apiFetch } from "@/lib/api/browser-client";
import { ApiError, throwIfResNotOk } from "@/lib/api/errors";
import type { AuthMeResponse, LoginResponse } from "./types";
import { getAuthHeaders } from "./session";

export async function fetchAuthMe(): Promise<AuthMeResponse> {
  return apiFetch<AuthMeResponse>("/api/auth/me", {
    headers: getAuthHeaders(),
  });
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  await throwIfResNotOk(res);
  return (await res.json()) as LoginResponse;
}

export async function logout(): Promise<void> {
  try {
    await apiFetch("/api/auth/logout", {
      method: "POST",
      headers: getAuthHeaders(),
    });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return;
    throw e;
  }
}
