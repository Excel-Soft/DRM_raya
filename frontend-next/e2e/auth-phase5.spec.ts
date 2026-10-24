import { test, expect } from "@playwright/test";
import {
  fetchApiStatus,
  fetchMeMeta,
  isAuditViewerRole,
  loginViaAuthPage,
} from "./helpers/auth";

const primaryEmail = process.env.E2E_EMAIL?.trim();
const primaryPassword = process.env.E2E_PASSWORD?.trim();
const hasPrimary = Boolean(primaryEmail && primaryPassword);

const restrictedEmail = process.env.E2E_EMAIL_RESTRICTED?.trim();
const restrictedPassword = process.env.E2E_PASSWORD_RESTRICTED?.trim();
const hasRestricted = Boolean(restrictedEmail && restrictedPassword);

test.describe("Phase 5 — authenticated sign-off", () => {
  test.skip(!hasPrimary, "Set E2E_EMAIL and E2E_PASSWORD for authenticated sign-off");

  test("1–2. login via /auth and Express GET /api/auth/me", async ({ page }) => {
    await loginViaAuthPage(page, primaryEmail!, primaryPassword!);
    const me = await fetchMeMeta(page);
    expect(me.status).toBe(200);
    expect(me.authenticated).toBe(true);
    if (me.authenticated) {
      expect(me.isActive).toBe(true);
      expect(me.activeRoleId).toBeTruthy();
    }
  });

  test("3. session restoration after hard reload", async ({ page }) => {
    await loginViaAuthPage(page, primaryEmail!, primaryPassword!);
    const before = await fetchMeMeta(page);
    expect(before.authenticated).toBe(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText("Sign out")).toBeVisible({ timeout: 20_000 });
    const after = await fetchMeMeta(page);
    expect(after.status).toBe(200);
    expect(after.authenticated).toBe(true);
  });

  test("4. notice-board UI and Express API", async ({ page }) => {
    await loginViaAuthPage(page, primaryEmail!, primaryPassword!);
    await page.goto("/notice-board");
    await expect(page.getByRole("heading", { name: "Notice Board" })).toBeVisible({ timeout: 20_000 });
    const api = await fetchApiStatus(page, "/api/notice-board");
    expect(api.status).toBe(200);
  });

  test("5. audit logs — Express authority matches role", async ({ page }) => {
    await loginViaAuthPage(page, primaryEmail!, primaryPassword!);
    const me = await fetchMeMeta(page);
    expect(me.authenticated).toBe(true);
    const canView =
      me.authenticated && isAuditViewerRole(me.activeRoleId, me.roles);

    await page.goto("/admin/audit-logs");
    const api = await fetchApiStatus(page, "/api/audit-logs?page=1&pageSize=1");

    if (canView) {
      expect(api.status).toBe(200);
      await expect(page.getByRole("heading", { name: "Audit Logs" })).toBeVisible({ timeout: 15_000 });
    } else {
      expect(api.status).toBe(403);
      const stillOnAudit = page.url().includes("/admin/audit-logs");
      if (stillOnAudit) {
        await expect(
          page.getByText(/403|permission to view audit logs|Access denied/i),
        ).toBeVisible({ timeout: 15_000 });
      } else {
        expect(stillOnAudit).toBe(false);
      }
    }
  });

  test("6. audit denial with restricted account (optional)", async ({ page }) => {
    test.skip(!hasRestricted, "Set E2E_EMAIL_RESTRICTED and E2E_PASSWORD_RESTRICTED for explicit denial case");
    await loginViaAuthPage(page, restrictedEmail!, restrictedPassword!);
    const me = await fetchMeMeta(page);
    expect(me.authenticated).toBe(true);
    const canView =
      me.authenticated && isAuditViewerRole(me.activeRoleId, me.roles);
    test.skip(canView, "Restricted account has audit viewer role; cannot assert denial");

    await page.goto("/admin/audit-logs");
    const api = await fetchApiStatus(page, "/api/audit-logs?page=1&pageSize=1");
    expect(api.status).toBe(403);
    await expect(page.getByText(/403|permission to view audit logs/i)).toBeVisible({ timeout: 15_000 });
  });

  test("7. logout clears session and returns to /auth", async ({ page }) => {
    await loginViaAuthPage(page, primaryEmail!, primaryPassword!);
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/auth/, { timeout: 20_000 });

    const tokenAfter = await page.evaluate(() => sessionStorage.getItem("token"));
    expect(tokenAfter).toBeNull();

    const me = await fetchApiStatus(page, "/api/auth/me");
    expect(me.status).toBe(401);
  });
});

test.describe("Phase 5 — unauthenticated (no credentials)", () => {
  test("8. protected route redirects to /auth", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/notice-board");
    await page.waitForURL(/\/auth/, { timeout: 20_000 });
    expect(page.url()).toMatch(/\/auth/);
  });
});
