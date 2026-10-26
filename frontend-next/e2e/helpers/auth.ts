import type { Page } from "@playwright/test";

export const AUDIT_LOG_VIEWER_ROLES = ["admin", "super_admin", "super_hod"] as const;

export async function loginViaAuthPage(page: Page, email: string, password: string) {
  await page.goto("/auth");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 25_000 });
  await page.getByText("Sign out").waitFor({ state: "visible", timeout: 20_000 });
}

/** Browser-only fetch through Next rewrites; returns sanitized metadata (no tokens/emails). */
export async function fetchMeMeta(page: Page) {
  return page.evaluate(async () => {
    const token = sessionStorage.getItem("token");
    if (!token) return { status: 0, authenticated: false as const };
    const res = await fetch("/api/auth/me", {
      credentials: "include",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { status: res.status, authenticated: false as const };
    const body = (await res.json()) as {
      activeRoleId?: string;
      roles?: string[];
      isActive?: boolean;
    };
    return {
      status: res.status,
      authenticated: true as const,
      activeRoleId: body.activeRoleId ?? null,
      roles: body.roles ?? [],
      isActive: body.isActive === true,
    };
  });
}

export async function fetchApiStatus(page: Page, path: string) {
  return page.evaluate(async (apiPath) => {
    const token = sessionStorage.getItem("token");
    const res = await fetch(apiPath, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return { status: res.status };
  }, path);
}

export function isAuditViewerRole(activeRoleId: string | null, roles: string[]): boolean {
  const set = new Set<string>();
  if (activeRoleId) set.add(activeRoleId.toLowerCase());
  roles.forEach((r) => set.add(String(r).toLowerCase()));
  return AUDIT_LOG_VIEWER_ROLES.some((r) => set.has(r));
}
