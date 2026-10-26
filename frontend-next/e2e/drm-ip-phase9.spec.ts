import { test, expect } from "@playwright/test";
import { fetchApiStatus, fetchMeMeta, loginViaAuthPage } from "./helpers/auth";
import { isAdminOnlyRole } from "./helpers/admin-roles";

const primaryEmail = process.env.E2E_EMAIL?.trim();
const primaryPassword = process.env.E2E_PASSWORD?.trim();
const hasPrimary = Boolean(primaryEmail && primaryPassword);

const restrictedEmail = process.env.E2E_EMAIL_RESTRICTED?.trim();
const restrictedPassword = process.env.E2E_PASSWORD_RESTRICTED?.trim();
const hasRestricted = Boolean(restrictedEmail && restrictedPassword);

const DRM_IP_PATH = "/dashboard/allowed-ip/drm-ip-list";
const API_PATH = "/api/settings/allowed-ips";

test.describe("Phase 9 — DRM IP List acceptance", () => {
  test.skip(!hasPrimary, "Set E2E_EMAIL and E2E_PASSWORD for authenticated DRM IP tests");

  test("admin-class user sees DRM IP list page", async ({ page }) => {
    await loginViaAuthPage(page, primaryEmail!, primaryPassword!);
    const me = await fetchMeMeta(page);
    expect(me.authenticated).toBe(true);

    await page.goto(DRM_IP_PATH);
    const canViewUi = me.authenticated && isAdminOnlyRole(me.activeRoleId ?? null, me.roles ?? []);

    if (canViewUi) {
      await expect(page.getByRole("heading", { name: "DRM IP List" })).toBeVisible({ timeout: 20_000 });
      const api = await fetchApiStatus(page, API_PATH);
      expect(api.status).toBe(200);
    } else {
      const onPage = page.url().includes(DRM_IP_PATH);
      if (onPage) {
        await expect(page.getByText(/Access denied|permission/i)).toBeVisible({ timeout: 15_000 });
      }
    }
  });
});

test.describe("Phase 9 — DRM IP List denial (optional restricted account)", () => {
  test.skip(!hasRestricted, "Set E2E_EMAIL_RESTRICTED and E2E_PASSWORD_RESTRICTED for denial case");

  test("non-admin user must not use admin-only UI route", async ({ page }) => {
    await loginViaAuthPage(page, restrictedEmail!, restrictedPassword!);
    const me = await fetchMeMeta(page);
    expect(me.authenticated).toBe(true);
    expect(isAdminOnlyRole(me.activeRoleId ?? null, me.roles ?? [])).toBe(false);

    await page.goto(DRM_IP_PATH);
    const stillOnRoute = page.url().includes(DRM_IP_PATH);
    if (stillOnRoute) {
      await expect(page.getByText(/Access denied|permission/i)).toBeVisible({ timeout: 15_000 });
    }

    const api = await fetchApiStatus(page, API_PATH);
    expect(api.status).toBe(403);
  });
});
