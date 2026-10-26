import { test, expect } from "@playwright/test";

const hasE2ECredentials = Boolean(process.env.E2E_EMAIL?.trim() && process.env.E2E_PASSWORD?.trim());

test.describe("auth — no credentials required", () => {
  test("login page renders branded sign-in form", async ({ page }) => {
    await page.goto("/auth");
    const card = page.getByTestId("login-card");
    await expect(card).toBeVisible();
    const radius = await card.evaluate((el) => getComputedStyle(el).borderRadius);
    expect(parseFloat(radius)).toBeGreaterThan(8);
    const boxShadow = await card.evaluate((el) => getComputedStyle(el).boxShadow);
    expect(boxShadow).not.toBe("none");
    await expect(page.getByRole("heading", { name: "DRM WebExcels" })).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("invalid credentials show accessible failure message", async ({ page }) => {
    await page.goto("/auth");
    await page.getByLabel("Email address").fill("e2e-invalid@example.invalid");
    await page.getByLabel("Password").fill("not-a-valid-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("form [role=alert]")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("form [role=alert]")).toContainText(/invalid|credential|failed/i);
  });

  test("password visibility toggle changes input type", async ({ page }) => {
    await page.goto("/auth");
    const password = page.getByLabel("Password");
    await password.fill("sample");
    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Show typed characters" }).click();
    await expect(password).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Hide typed characters" }).click();
    await expect(password).toHaveAttribute("type", "password");
  });

  test("unauthenticated user is redirected from protected route", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/notice-board");
    await page.waitForURL(/\/auth/, { timeout: 20_000 });
    await expect(page).toHaveURL(/\/auth/);
  });
});

test.describe("auth — credentials from environment", () => {
  test.skip(!hasE2ECredentials, "Set E2E_EMAIL and E2E_PASSWORD to run authenticated flows");

  test("login success reaches home", async ({ page }) => {
    await page.goto("/auth");
    await page.getByLabel("Email address").fill(process.env.E2E_EMAIL!);
    await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 20_000 });
    await expect(page.getByText("Sign out")).toBeVisible({ timeout: 15_000 });
  });

  test("session survives reload", async ({ page }) => {
    await page.goto("/auth");
    await page.getByLabel("Email address").fill(process.env.E2E_EMAIL!);
    await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 20_000 });
    await page.reload();
    await expect(page.getByText("Sign out")).toBeVisible({ timeout: 15_000 });
  });

  test("logout returns to sign-in", async ({ page }) => {
    await page.goto("/auth");
    await page.getByLabel("Email address").fill(process.env.E2E_EMAIL!);
    await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 20_000 });
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/auth/, { timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });
});
